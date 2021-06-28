import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import * as fs from 'mz/fs';

export const generateKeyPair = (secret: string) => {
  const secretBuffer = Buffer.from(secret, 'base64');
  return Keypair.fromSecretKey(Uint8Array.from(secretBuffer));
};

export const readAccountFromFile = async (
  filePath: string,
): Promise<Keypair> => {
  const keypairString = await fs.readFile(filePath, { encoding: 'utf8' });
  const keypairBuffer = Buffer.from(JSON.parse(keypairString));
  return Keypair.fromSecretKey(keypairBuffer);
};

/**
 * Establish a connection to the cluster
 */
export const establishConnection = async (
  rpcUrl = 'https://api.devnet.solana.com',
): Promise<Connection> => {
  const connection = new Connection(rpcUrl, 'confirmed');
  return connection;
};

export const newAccountWithLamports = async (
  connection: Connection,
  lamports = 1000000,
): Promise<Keypair> => {
  const account = new Keypair();
  const signature = await connection.requestAirdrop(
    account.publicKey,
    lamports,
  );
  await connection.confirmTransaction(signature);
  return account;
};

export const selfTransfer = async (
  connection: Connection,
  payerAccount: Keypair,
) => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payerAccount.publicKey,
      toPubkey: payerAccount.publicKey,
      lamports: 1000,
    }),
  );
  const txHash = await sendAndConfirmTransaction(connection, transaction, [
    payerAccount,
  ]);
  return txHash;
};
