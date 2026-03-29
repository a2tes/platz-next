import { localStorageService } from "./localStorageService";
import { s3Service } from "./s3Service";
import { StorageProvider } from "../interfaces/StorageProvider";

class StorageService {
	private provider: StorageProvider;

	constructor() {
		const driver = process.env.STORAGE_DRIVER || "local";
		this.provider = driver === "s3" ? s3Service : localStorageService;
	}

	getProvider(): StorageProvider {
		return this.provider;
	}
}

export const storageService = new StorageService().getProvider();
