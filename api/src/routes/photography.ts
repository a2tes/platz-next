import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { photographersController } from "../controllers/photographersController";
import { photographyItemsController } from "../controllers/photographyItemsController";

const router = Router();

// Apply authentication
router.use(authenticateToken);

// Photographers routes
router.post("/photographers", photographersController.create.bind(photographersController));
router.get("/photographers", photographersController.list.bind(photographersController));
router.post(
	"/photographers/bulk/delete",
	photographersController.bulkDeletePhotographers.bind(photographersController),
);
router.post("/photographers/bulk/purge", photographersController.bulkPurgePhotographers.bind(photographersController));
router.post("/photographers/reorder", photographersController.reorder.bind(photographersController));
router.get("/photographers/counts", photographersController.getCounts.bind(photographersController));
router.get("/photographers/trash", photographersController.listTrashed.bind(photographersController));
router.get("/photographers/:id", photographersController.getById.bind(photographersController));
router.put("/photographers/:id", photographersController.update.bind(photographersController));
router.delete("/photographers/:id", photographersController.delete.bind(photographersController));
router.post("/photographers/:id/trash", photographersController.trash.bind(photographersController));
router.post("/photographers/:id/restore", photographersController.restore.bind(photographersController));
router.post("/photographers/:id/purge", photographersController.purge.bind(photographersController));
router.patch("/photographers/:id/publish", photographersController.publish.bind(photographersController));
router.patch("/photographers/:id/unpublish", photographersController.unpublish.bind(photographersController));
router.patch("/photographers/:id/title", photographersController.updateTitle.bind(photographersController));
router.post(
	"/photographers/bulk/publish",
	photographersController.bulkPublishPhotographers.bind(photographersController),
);
router.post(
	"/photographers/bulk/unpublish",
	photographersController.bulkUnpublishPhotographers.bind(photographersController),
);

// Photography items routes
router.get("/items", photographyItemsController.list.bind(photographyItemsController));
router.post("/items", photographyItemsController.create.bind(photographyItemsController));
router.post("/items/bulk", photographyItemsController.bulkCreate.bind(photographyItemsController));
router.put("/items/:id", photographyItemsController.update.bind(photographyItemsController));
router.post("/items/reorder", photographyItemsController.reorder.bind(photographyItemsController));
router.post("/items/reorder-groups", photographyItemsController.reorderGroups.bind(photographyItemsController));
router.patch("/items/:id/move-to-client", photographyItemsController.moveToClient.bind(photographyItemsController));
router.delete("/items/:id", photographyItemsController.delete.bind(photographyItemsController));

export default router;
