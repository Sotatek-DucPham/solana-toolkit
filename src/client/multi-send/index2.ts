import 'dotenv/config';
import { establishConnection, generateKeyPair } from '../../lib';
import { Token, TOKEN_PROGRAM_ID } from '../../lib/token';
import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

const secret = process.env.PAYER_SECRET || '';

(async () => {
  const connection = await establishConnection();
  const payerAccount = generateKeyPair(secret);
  console.log(`Payer Account is ${payerAccount.publicKey.toBase58()}`);

  const tokenPubKey = new PublicKey(
    '8gJTD3r1dgGGkQrPWELLbSkFs23TSQY6P2NZK1afaodp',
  );
  const token = new Token(
    connection,
    tokenPubKey,
    TOKEN_PROGRAM_ID,
    payerAccount,
  );

  const accountPubKey = new PublicKey(
    '4NLjjf8Ech39b9jFzk2xHUnmyehDYxMs78a2napL81eN',
  );
  const txHash = await token.transfer(
    accountPubKey,
    accountPubKey,
    payerAccount.publicKey,
    [],
    1,
  );
  console.log(txHash);

  console.log(await token.getMintInfo());
  console.log(await token.getAccountInfo(accountPubKey));

  console.log((await token.createAccount(tokenPubKey)).toBase58());

  console.log(
    await token.transferChecked(
      accountPubKey,
      accountPubKey,
      payerAccount.publicKey,
      [],
      1,
      9,
    ),
  );

  const newTx = [...Array(55).keys()].reduce((previous, _) => {
    return previous.add(
      Token.createTransferCheckedInstruction(
        token.programId,
        accountPubKey,
        tokenPubKey,
        accountPubKey,
        payerAccount.publicKey,
        [],
        1,
        9,
      ),
    );
  }, new Transaction());
  console.log(
    await sendAndConfirmTransaction(connection, newTx, [payerAccount]),
  );
})();
