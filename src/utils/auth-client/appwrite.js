import { Client, Account, Storage, ID } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://api.marketingtool.pro/v1";
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6952c8a0002d3365625d";

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

export const appwriteClient = client;
export const appwriteAccount = new Account(client);
export const appwriteStorage = new Storage(client);
export { ID };
