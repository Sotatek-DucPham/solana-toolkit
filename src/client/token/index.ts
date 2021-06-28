import {
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import 'dotenv/config';
import {
  establishConnection,
  generateKeyPair,
  readAccountFromFile,
} from '../../lib';
import { resolve, join } from 'path';
import * as fs from 'mz/fs';
import * as borsh from 'borsh';

const secret = process.env.PAYER_SECRET || '';
const programPath = resolve(__dirname, '../../program/token/dist');
const programSoPath = join(programPath, 'spl_token.so');
const programKeyPairPath = join(programPath, 'spl_token-keypair.json');

(async () => {
  const connection = await establishConnection();
  const payerAccount = generateKeyPair(secret);
  console.log(`Payer Account is ${payerAccount.publicKey.toBase58()}`);

  const programAccount = await readAccountFromFile(programKeyPairPath);
  const programId = programAccount.publicKey;
  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    let fees = 0;
    const { feeCalculator } = await connection.getRecentBlockhash();

    // Calculate the cost to load the program
    const program = await fs.readFile(programSoPath);
    const NUM_RETRIES = 1; // allow some number of retries
    fees +=
      feeCalculator.lamportsPerSignature *
        (BpfLoader.getMinNumSignatures(program.length) + NUM_RETRIES) +
      (await connection.getMinimumBalanceForRentExemption(program.length));

    // Calculate the cost of sending the transactions
    fees += feeCalculator.lamportsPerSignature * 100;

    // Load the program
    console.log('Loading program, this may take a minute...');
    await BpfLoader.load(
      connection,
      payerAccount,
      programAccount,
      program,
      BPF_LOADER_PROGRAM_ID,
    );
    console.log(`Token: Using program ${programId.toBase58()}`);
  } else {
    console.log(`Token: Reusing program ${programId.toBase58()}`);
  }
})();
