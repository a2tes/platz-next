import { Request, Response } from "express";
import { SettingsService } from "../services/settingsService";
import { z } from "zod";

const apiResponse = {
	success: (data: any, meta?: any) => ({
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), ...meta },
	}),
	error: (message: string, code: string) => ({
		success: false,
		error: {
			code,
			message,
			timestamp: new Date().toISOString(),
		},
	}),
};

const updateSettingsSchema = z.record(z.string(), z.any());

export class SettingsController {
	/**
	 * GET /api/settings - Get all site settings
	 */
	static async getSettings(req: Request, res: Response) {
		try {
			const settings = await SettingsService.getAll();
			res.json(apiResponse.success(settings));
		} catch (error) {
			console.error("Error fetching settings:", error);
			res.status(500).json(apiResponse.error("Failed to fetch settings", "SETTINGS_FETCH_ERROR"));
		}
	}

	/**
	 * PUT /api/settings - Update multiple settings
	 */
	static async updateSettings(req: Request, res: Response) {
		try {
			const parsed = updateSettingsSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json(apiResponse.error("Invalid settings data", "VALIDATION_ERROR"));
			}

			const settings = await SettingsService.updateMany(parsed.data);
			res.json(apiResponse.success(settings));
		} catch (error) {
			console.error("Error updating settings:", error);
			res.status(500).json(apiResponse.error("Failed to update settings", "SETTINGS_UPDATE_ERROR"));
		}
	}
}
