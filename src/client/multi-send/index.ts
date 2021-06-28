import 'dotenv/config';
import { resolve, join } from 'path';
import * as fs from 'mz/fs';
import {
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import * as BufferLayout from 'buffer-layout';
import * as BN from 'bn.js';
import * as assert from 'assert';
import { establishConnection, generateKeyPair } from '../../lib';
import * as Layout from './layout';

const secret = process.env.PAYER_SECRET || '';
const programPath = resolve(__dirname, '../../program/token/dist');
const programSoPath = join(programPath, 'spl_token.so');
const programKeyPairPath = join(programPath, 'spl_token-keypair.json');

export class u64 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 8) {
      return b;
    }
    assert(b.length < 8, 'u64 too large');

    const zeroPad = Buffer.alloc(8);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a u64 from Buffer representation
   */
  static fromBuffer(buffer: Buffer): u64 {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new u64(
      [...buffer]
        .reverse()
        .map((i) => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

(async () => {
  const connection = await establishConnection();
  const payerAccount = generateKeyPair(secret);
  console.log(`Payer Account is ${payerAccount.publicKey.toBase58()}`);

  const amount = 1;
  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    Layout.uint64('amount'),
  ]);

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 3, // Transfer instruction
      amount: new u64(amount).toBuffer(),
    },
    data,
  );

  const tokenProgramId = '8gJTD3r1dgGGkQrPWELLbSkFs23TSQY6P2NZK1afaodp';
  const tokenAccount = '4NLjjf8Ech39b9jFzk2xHUnmyehDYxMs78a2napL81eN';
  const txInstruction = new TransactionInstruction({
    keys: [
      {
        pubkey: new PublicKey(tokenAccount),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(tokenAccount),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: payerAccount.publicKey,
        isSigner: true,
        isWritable: false,
      },
    ],
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    data: data,
  });

  const tx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(txInstruction).add(txInstruction),
    [payerAccount],
  );
  console.log({ tx });
})();
