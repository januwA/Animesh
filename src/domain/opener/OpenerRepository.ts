export interface OpenerRepository {
	openUrl(url: string): Promise<void>;
}
