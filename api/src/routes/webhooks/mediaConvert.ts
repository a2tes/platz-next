import { Router, Request, Response } from "express";
import { videoProcessingService } from "../../services/videoProcessingService";
import { clipProcessingService } from "../../services/clipProcessingService";
import { clipJobService } from "../../services/clipJobService";

const router = Router();

/**
 * AWS SNS message types
 */
interface SNSMessage {
	Type: string;
	MessageId: string;
	TopicArn: string;
	Subject?: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: string;
	Signature: string;
	SigningCertURL: string;
	SubscribeURL?: string;
	UnsubscribeURL?: string;
}

/**
 * MediaConvert CloudWatch Event structure (via SNS)
 */
interface MediaConvertEvent {
	version: string;
	id: string;
	"detail-type": string;
	source: string;
	account: string;
	time: string;
	region: string;
	resources: string[];
	detail: {
		status: "COMPLETE" | "ERROR" | "PROGRESSING" | "INPUT_INFORMATION" | "STATUS_UPDATE";
		jobId: string;
		queue: string;
		userMetadata?: Record<string, string>;
		outputGroupDetails?: Array<{
			outputDetails: Array<{
				outputFilePaths: string[];
				durationInMs: number;
				videoDetails?: {
					widthInPx: number;
					heightInPx: number;
				};
			}>;
		}>;
		errorCode?: number;
		errorMessage?: string;
		jobProgress?: {
			jobPercentComplete: number;
			currentPhase: string;
		};
	};
}

/**
 * POST /webhooks/mediaconvert
 *
 * Receives SNS notifications from AWS MediaConvert via CloudWatch Events
 *
 * Flow:
 * 1. MediaConvert job status changes
 * 2. CloudWatch Event Rule triggers
 * 3. SNS Topic receives event
 * 4. SNS calls this webhook
 */
router.post("/", async (req: Request, res: Response) => {
	try {
		// SNS sends Content-Type: text/plain, so body might be string
		const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

		// Debug: Log raw incoming body
		console.log("[MediaConvert Webhook] Raw body:", JSON.stringify(body, null, 2));

		// Handle SNS subscription confirmation
		if (body.Type === "SubscriptionConfirmation") {
			console.log("[MediaConvert Webhook] SNS Subscription confirmation received");
			console.log("[MediaConvert Webhook] SubscribeURL:", body.SubscribeURL);

			// Auto-confirm subscription by fetching the URL
			if (body.SubscribeURL) {
				try {
					const response = await fetch(body.SubscribeURL);
					if (response.ok) {
						console.log("[MediaConvert Webhook] Subscription confirmed automatically");
					}
				} catch (e) {
					console.log("[MediaConvert Webhook] Manual confirmation required:", body.SubscribeURL);
				}
			}

			return res.status(200).json({ message: "Subscription confirmation received" });
		}

		// Handle notification - could be wrapped in SNS or direct from EventBridge
		let message: MediaConvertEvent;

		if (body.Type === "Notification" && body.Message) {
			// SNS wrapped message - parse the inner message
			const innerMessage = JSON.parse(body.Message);

			// Check if inner message is standard CloudWatch Event format or InputTransformer format
			if (innerMessage.detail && innerMessage["detail-type"]) {
				// Standard CloudWatch Event format
				message = innerMessage;
			} else if (innerMessage.status && innerMessage.jobId) {
				// InputTransformer simplified format inside SNS
				message = {
					version: "0",
					id: innerMessage.id || "unknown",
					"detail-type": "MediaConvert Job State Change",
					source: "aws.mediaconvert",
					account: innerMessage.account || "unknown",
					time: innerMessage.time || new Date().toISOString(),
					region: innerMessage.region || "unknown",
					resources: innerMessage.resources || [],
					detail: {
						status: innerMessage.status,
						jobId: innerMessage.jobId,
						queue: innerMessage.queue || "",
						userMetadata: innerMessage.userMetadata,
						outputGroupDetails: innerMessage.outputFilePaths, // Note: InputTransformer uses outputFilePaths
						errorCode: innerMessage.errorCode ? parseInt(innerMessage.errorCode) : undefined,
						errorMessage: innerMessage.errorMessage || undefined,
					},
				};
			} else {
				console.error("[MediaConvert Webhook] Unknown inner message format:", JSON.stringify(innerMessage, null, 2));
				return res.status(400).json({ error: "Unknown inner message format" });
			}
		} else if (body.detail && body["detail-type"]) {
			// Direct EventBridge format (when InputTransformer passes through)
			message = body as MediaConvertEvent;
		} else if (body.status && body.jobId) {
			// Simplified format from InputTransformer
			message = {
				version: "0",
				id: body.id || "unknown",
				"detail-type": "MediaConvert Job State Change",
				source: "aws.mediaconvert",
				account: body.account || "unknown",
				time: body.time || new Date().toISOString(),
				region: body.region || "unknown",
				resources: body.resources || [],
				detail: {
					status: body.status,
					jobId: body.jobId,
					queue: body.queue || "",
					userMetadata: body.userMetadata,
					outputGroupDetails: body.outputGroupDetails,
					errorCode: body.errorCode,
					errorMessage: body.errorMessage,
				},
			};
		} else {
			console.error("[MediaConvert Webhook] Unknown message format:", JSON.stringify(body, null, 2));
			return res.status(400).json({ error: "Unknown message format" });
		}

		if (!message.detail || !message.detail.status) {
			console.error("[MediaConvert Webhook] Missing detail or status in message:", JSON.stringify(message, null, 2));
			return res.status(400).json({ error: "Missing detail or status" });
		}

		console.log(`[MediaConvert Webhook] Received event: ${message.detail.status} for job ${message.detail.jobId}`);

		const { status, jobId, errorMessage, errorCode, userMetadata } = message.detail;

		// Check if this is a clip job - either by userMetadata or by looking up in ClipJob table
		const isClipJob = userMetadata?.jobType === "clip" || (await clipJobService.findByMediaConvertJobId(jobId));

		switch (status) {
			case "COMPLETE":
				// Handle clip job completion
				if (isClipJob) {
					await clipProcessingService.handleClipJobComplete(
						jobId,
						"COMPLETE",
						(userMetadata as {
							clipJobId?: string;
							blockId?: string;
							slotIndex?: string;
							settingsHash?: string;
							jobType?: string;
						}) || {},
					);
					console.log(`[MediaConvert Webhook] Clip job ${jobId} completed successfully`);
					break;
				}

				// Extract video metadata from output details
				let videoMetadata: { width?: number; height?: number; duration?: number } | undefined;
				if (message.detail.outputGroupDetails) {
					for (const outputGroup of message.detail.outputGroupDetails) {
						for (const output of outputGroup.outputDetails) {
							if (output.videoDetails) {
								videoMetadata = {
									width: output.videoDetails.widthInPx,
									height: output.videoDetails.heightInPx,
									duration: output.durationInMs ? output.durationInMs / 1000 : undefined,
								};
								break;
							}
						}
						if (videoMetadata) break;
					}
				}
				await videoProcessingService.handleJobComplete(jobId, "COMPLETE", undefined, userMetadata, videoMetadata);
				console.log(`[MediaConvert Webhook] Job ${jobId} completed successfully`);
				break;

			case "ERROR":
				const error = errorMessage || `Error code: ${errorCode}`;
				// Handle clip job error
				if (isClipJob) {
					await clipProcessingService.handleClipJobComplete(
						jobId,
						"ERROR",
						(userMetadata as {
							clipJobId?: string;
							blockId?: string;
							slotIndex?: string;
							settingsHash?: string;
							jobType?: string;
						}) || {},
						error,
					);
					console.error(`[MediaConvert Webhook] Clip job ${jobId} failed: ${error}`);
					break;
				}
				await videoProcessingService.handleJobComplete(jobId, "ERROR", error, userMetadata);
				console.error(`[MediaConvert Webhook] Job ${jobId} failed: ${error}`);
				break;

			case "PROGRESSING":
				// Optional: Update progress in database
				if (message.detail.jobProgress) {
					console.log(
						`[MediaConvert Webhook] Job ${jobId} progress: ${message.detail.jobProgress.jobPercentComplete}%`,
					);
				}
				break;

			case "STATUS_UPDATE":
				console.log(`[MediaConvert Webhook] Job ${jobId} status update`);
				break;

			default:
				console.log(`[MediaConvert Webhook] Unhandled status: ${status}`);
		}

		return res.status(200).json({ message: "Notification processed" });
	} catch (error) {
		console.error("[MediaConvert Webhook] Error processing webhook:", error);
		// Return 200 to prevent SNS retries for parsing errors
		return res.status(200).json({ error: "Processing error" });
	}
});

/**
 * GET /webhooks/mediaconvert/health
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
	res.json({ status: "ok", service: "mediaconvert-webhook" });
});

export default router;
