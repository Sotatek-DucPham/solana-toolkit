import {
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
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
const programPath = resolve(__dirname, '../../program/hello-world/dist');
const programSoPath = join(programPath, 'helloworld.so');
const programKeyPairPath = join(programPath, 'helloworld-keypair.json');

class GreetingAccount {
  counter = 0;
  constructor(fields: { counter: number } | undefined = undefined) {
    if (fields) {
      this.counter = fields.counter;
    }
  }
}
const GreetingSchema = new Map([
  [GreetingAccount, { kind: 'struct', fields: [['counter', 'u32']] }],
]);
const GREETING_SIZE = borsh.serialize(
  GreetingSchema,
  new GreetingAccount(),
).length;

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
    const NUM_RETRIES = 500; // allow some number of retries
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
    console.log(`Helloworld: Using program ${programId.toBase58()}`);
  } else {
    console.log(`Helloworld: Reusing program ${programId.toBase58()}`);
  }

  // Derive the address of a greeting account from the program so that it's easy to find later.
  const GREETING_SEED = 'hello';
  const greetedPubkey = await PublicKey.createWithSeed(
    payerAccount.publicKey,
    GREETING_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const greetedAccount = await connection.getAccountInfo(greetedPubkey);
  if (greetedAccount === null) {
    console.log(
      'Creating account',
      greetedPubkey.toBase58(),
      'to say hello to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payerAccount.publicKey,
        basePubkey: payerAccount.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: greetedPubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payerAccount]);
  }

  console.log('Saying hello to', greetedPubkey.toBase58());
  const instruction = new TransactionInstruction({
    keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
    programId,
    data: Buffer.alloc(0), // All instructions are hellos
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payerAccount],
  );

  if (greetedAccount === null) {
    throw 'Error: cannot find the greeted account';
  }
  const greeting = borsh.deserialize(
    GreetingSchema,
    GreetingAccount,
    greetedAccount.data,
  );
  console.log(
    greetedPubkey.toBase58(),
    'has been greeted',
    greeting.counter,
    'time(s)',
  );
})();
