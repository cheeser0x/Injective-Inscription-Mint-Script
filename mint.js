const { getNetworkInfo, Network } = require('@injectivelabs/networks');
const { TxClient, PrivateKey, TxGrpcClient, ChainRestAuthApi, createTransaction, MsgSend } = require('@injectivelabs/sdk-ts');
const { BigNumberInBase, DEFAULT_STD_FEE, Bech32Address } = require('@injectivelabs/utils');

(async () => {


  //This is the code for a private rpc, if using public endpoints use Mainnet.sentry/Testnet.sentry

  const network = {
    feeDenom: 'inj',
    chainId: 'injective-1',
    ethereumChainId: 1,
    env: 'mainnet',
    indexer: 'https://sentry.exchange.grpc-web.injective.network',
    grpc: 'https://sentry.chain.grpc-web.injective.network',
    rpc: 'your_rpc_url',
    rest: 'your_rest_url',
    chronos: 'https://sentry.exchange.grpc-web.injective.network',
    explorer: 'https://sentry.exchange.grpc-web.injective.network',
    cache: 'https://sentry.exchange.grpc-web.injective.network'
  };

  
  const privateKeyHash = 'your_private_key_hash';  // Fill in your private key hash
  const privateKey = PrivateKey.fromHex(privateKeyHash);
  const injectiveAddress = privateKey.toBech32();
  const publicKey = privateKey.toPublicKey().toBase64();

  while (true) {
    // Fetch account details
    const accountDetails = await new ChainRestAuthApi(network.rest).fetchAccount(injectiveAddress);

    // Prepare message
    const recipient = 'your_destination_address'; // Replace with a valid Bech32 address

    const amount = {
      amount: new BigNumberInBase(0.01).toWei().toFixed(),
      denom: 'inj'
    };

    const msg = MsgSend.fromJSON({
      amount,
      srcInjectiveAddress: injectiveAddress,
      dstInjectiveAddress: recipient,
    });

    // Create transaction
    const { signBytes, txRaw } = createTransaction({
      message: msg,
      memo: 'ZGF0YToseyJwIjoiaW5qcmMtMjAiLCJvcCI6Im1pbnQiLCJ0aWNrIjoiSU5KUyIsImFtdCI6IjEwMDAifQ==',

      //custom fee/gas syntax below. To use standard, use imported DEFAULT_STANDARD_FEE variable.
      fee: {
        amount: [ { amount: '35000000000000000', denom: 'inj' } ],
        gas: '1000000'
      },
      pubKey: publicKey,
      sequence: parseInt(accountDetails.account.base_account.sequence, 10),
      accountNumber: parseInt(accountDetails.account.base_account.account_number, 10),
      chainId: network.chainId,
    });

    // Sign transaction
    const signature = await privateKey.sign(Buffer.from(signBytes));
    txRaw.signatures = [signature];

    // Calculate transaction hash
    console.log(`Transaction Hash: ${TxClient.hash(txRaw)}`);

    const txService = new TxGrpcClient(network.grpc);

    // Simulate transaction
    const simulationResponse = await txService.simulate(txRaw);
    console.log(`Transaction simulation response: ${JSON.stringify(simulationResponse.gasInfo)}`);

    // Broadcast transaction
    const txResponse = await txService.broadcast(txRaw);

    if (txResponse.code !== 0) {
      console.error(`Transaction failed: ${txResponse.rawLog}`);

      // Check for sequence mismatch error and handle appropriately
      if (txResponse.rawLog.includes('account sequence mismatch')) {
        console.log('Retrying with updated account sequence...');
        continue;
      }

    } else {
      console.log(`Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`);
    }

    // Delay before next transaction (5000 milliseconds = 5 seconds)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
})().catch(console.error);
