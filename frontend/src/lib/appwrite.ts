import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6952ae110004699b5db3');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };
