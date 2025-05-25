import { allowLists } from "@/allowlist";
import {
  CandyGuard,
  CandyMachine,
  GuardGroup,
  DefaultGuardSet,
  DefaultGuardSetMintArgs,
  getMerkleRoot,
  route,
  getMerkleProof,
  safeFetchAllowListProofFromSeeds,
  mintV2,
  TokenBurnArgs,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  DigitalAssetWithToken,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  some,
  Umi,
  transactionBuilder,
  publicKey,
  TransactionBuilder,
  none,
  AddressLookupTableInput,
  Transaction,
  Signer,
  sol,
  BlockhashWithExpiryBlockHeight,
} from "@metaplex-foundation/umi";
import { GuardReturn } from "./checkerHelper";
import { Connection } from "@solana/web3.js";
import {
  setComputeUnitPrice,
  setComputeUnitLimit,
  transferSol,
} from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

export interface GuardButtonList extends GuardReturn {
  header: string;
  mintText: string;
  tokenPriceText?: string; // Precio en tokens (opcional)
  buttonLabel: string;
  startTime: bigint;
  endTime: bigint;
  tooltip?: string;
}

export const chooseGuardToUse = (
  guard: GuardReturn,
  candyGuard: CandyGuard
) => {
  let guardGroup = candyGuard?.groups.find(
    (item) => item.label === guard.label
  );
  if (guardGroup) {
    // console.log('Guard details:', JSON.stringify(guardGroup.guards, (key, value) => {
    //   // Convertir BigInt a string para que sea serializable
    //   if (typeof value === 'bigint') {
    //     return value.toString();
    //   }
    //   return value;
    // }, 2));
    return guardGroup;
  }

  if (candyGuard != null) {
    console.log('Using default guard configuration');
    console.log('Default guard details:', JSON.stringify(candyGuard.guards, (key, value) => {
      // Convertir BigInt a string para que sea serializable
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2));
    return {
      label: "default",
      guards: candyGuard.guards,
    };
  }

  console.error("No guards defined! No minting possible.");
  return {
    label: "default",
    guards: undefined,
  };
};

export const mintArgsBuilder = (
  candyMachine: CandyMachine,
  guardToUse: GuardGroup<DefaultGuardSet>,
  ownedTokens: DigitalAssetWithToken[],
  defaultGuard?: GuardGroup<DefaultGuardSet> // Optional default guard parameter
) => {
  const guards = guardToUse.guards;

  let ruleset = undefined;
  if (candyMachine.ruleSet.__option === "Some") {
    ruleset = candyMachine.ruleSet.value;
  }

  // Log de la guard completa con todas sus propiedades
  // console.log('GUARD COMPLETA:', JSON.stringify({
  //   label: guardToUse.label,
  //   guards: {
  //     addressGate: guards.addressGate,
  //     allocation: guards.allocation,
  //     allowList: guards.allowList,
  //     endDate: guards.endDate,
  //     freezeSolPayment: guards.freezeSolPayment,
  //     freezeTokenPayment: guards.freezeTokenPayment,
  //     gatekeeper: guards.gatekeeper,
  //     mintLimit: guards.mintLimit,
  //     nftBurn: guards.nftBurn,
  //     nftGate: guards.nftGate,
  //     nftPayment: guards.nftPayment,
  //     redeemedAmount: guards.redeemedAmount,
  //     solPayment: guards.solPayment,
  //     startDate: guards.startDate,
  //     thirdPartySigner: guards.thirdPartySigner,
  //     token2022Payment: guards.token2022Payment,
  //     tokenBurn: guards.tokenBurn,
  //     tokenGate: guards.tokenGate
  //   }
  // }, (key, value) => {
  //   if (typeof value === 'bigint') {
  //     return value.toString();
  //   }
  //   return value;
  // }, 2));
  
  let mintArgs: Partial<DefaultGuardSetMintArgs> = {};
  if (guards.allocation.__option === "Some") {
    mintArgs.allocation = some({ id: guards.allocation.value.id });
  }

  if (guards.allowList.__option === "Some") {
    const allowlist = allowLists.get(guardToUse.label);
    if (!allowlist) {
      console.error(`allowlist for guard ${guardToUse.label} not found!`);
    } else {
      mintArgs.allowList = some({ merkleRoot: getMerkleRoot(allowlist) });
    }
  }

  if (guards.freezeSolPayment.__option === "Some") {
    mintArgs.freezeSolPayment = some({
      destination: guards.freezeSolPayment.value.destination,
    });
  }

  if (guards.freezeTokenPayment.__option === "Some") {
    mintArgs.freezeTokenPayment = some({
      destinationAta: guards.freezeTokenPayment.value.destinationAta,
      mint: guards.freezeTokenPayment.value.mint,
      nftRuleSet: ruleset,
    });
  }

  if (guards.gatekeeper.__option === "Some") {
    mintArgs.gatekeeper = some({
      expireOnUse: guards.gatekeeper.value.expireOnUse,
      gatekeeperNetwork: guards.gatekeeper.value.gatekeeperNetwork,
    });
  }

  if (guards.mintLimit.__option === "Some") {
    mintArgs.mintLimit = some({ id: guards.mintLimit.value.id });
  }

  if (guards.nftBurn.__option === "Some") {
    const requiredCollection = guards.nftBurn.value.requiredCollection;
    //TODO: have the use choose the NFT
    const nft = ownedTokens.find(
      (el) =>
        el.metadata.collection.__option === "Some" &&
        el.metadata.collection.value.key === requiredCollection
    );
    if (!nft) {
      console.error("no nft to burn found!");
    } else {
      let tokenStandard = TokenStandard.NonFungible;
      let ruleSet = undefined;
      if (nft.metadata.tokenStandard.__option === "Some") {
        if (
          nft.metadata.tokenStandard.value ===
          TokenStandard.ProgrammableNonFungible
        ) {
          tokenStandard = TokenStandard.ProgrammableNonFungible;
          if (
            nft.metadata.programmableConfig.__option === "Some" &&
            nft.metadata.programmableConfig.value.ruleSet.__option === "Some"
          ) {
            ruleSet = nft.metadata.programmableConfig.value.ruleSet.value;
          }
        }
      }
      mintArgs.nftBurn = some({
        mint: nft.publicKey,
        requiredCollection,
        tokenStandard,
        ruleSet,
      });
    }
  }

  if (guards.nftGate.__option === "Some") {
    const requiredCollection = guards.nftGate.value.requiredCollection;
    const nft = ownedTokens.find(
      (el) =>
        el.metadata.collection.__option === "Some" &&
        el.metadata.collection.value.key === requiredCollection
    );
    if (!nft) {
      console.error("no nft for tokenGate found!");
    } else {
      let tokenStandard = TokenStandard.NonFungible;
      let ruleSet = undefined;
      if (nft.metadata.tokenStandard.__option === "Some") {
        if (
          nft.metadata.tokenStandard.value ===
          TokenStandard.ProgrammableNonFungible
        ) {
          tokenStandard = TokenStandard.ProgrammableNonFungible;
          if (
            nft.metadata.programmableConfig.__option === "Some" &&
            nft.metadata.programmableConfig.value.ruleSet.__option === "Some"
          ) {
            ruleSet = nft.metadata.programmableConfig.value.ruleSet.value;
          }
        }
      }
      mintArgs.nftGate = some({
        mint: nft.publicKey,
        requiredCollection,
        tokenStandard,
        ruleSet,
      });
    }
  }

  if (guards.nftPayment.__option === "Some") {
    const requiredCollection = guards.nftPayment.value.requiredCollection;
    const nft = ownedTokens.find(
      (el) =>
        el.metadata.collection.__option === "Some" &&
        el.metadata.collection.value.key === requiredCollection
    );
    if (!nft) {
      console.error("no nft for tokenGate found!");
    } else {
      let tokenStandard = TokenStandard.NonFungible;
      let ruleSet = undefined;
      if (nft.metadata.tokenStandard.__option === "Some") {
        if (
          nft.metadata.tokenStandard.value ===
          TokenStandard.ProgrammableNonFungible
        ) {
          tokenStandard = TokenStandard.ProgrammableNonFungible;
          if (
            nft.metadata.programmableConfig.__option === "Some" &&
            nft.metadata.programmableConfig.value.ruleSet.__option === "Some"
          ) {
            ruleSet = nft.metadata.programmableConfig.value.ruleSet.value;
          }
        }
      }
      mintArgs.nftPayment = some({
        destination: guards.nftPayment.value.destination,
        mint: nft.publicKey,
        requiredCollection,
        tokenStandard,
        ruleSet,
      });
    }
  }

  if (guards.solPayment.__option === "Some") {
    mintArgs.solPayment = some({
      destination: guards.solPayment.value.destination,
    });
  }

  if (guards.thirdPartySigner.__option === "Some") {
    console.error("not supported. you need a backend");
  }

  if (guards.token2022Payment.__option === "Some") {
    mintArgs.token2022Payment = some({
      destinationAta: guards.token2022Payment.value.destinationAta,
      mint: guards.token2022Payment.value.mint,
    });
  }

  // Removed duplicate tokenBurn check

  if (guards.tokenGate.__option === "Some") {
    mintArgs.tokenGate = some({ mint: guards.tokenGate.value.mint });
  }

  // Check if the selected guard has tokenBurn, if not, check the default guard
  if (guards.tokenBurn.__option === "Some") {
    console.log('Using tokenBurn from selected guard:', guardToUse.label);
    mintArgs.tokenBurn = some({
      mint: guards.tokenBurn.value.mint,
      amount: guards.tokenBurn.value.amount,
    });
  } else if (defaultGuard && defaultGuard.guards.tokenBurn.__option === "Some") {
    // If the selected guard doesn't have tokenBurn but default guard does, use that
    console.log('Using tokenBurn from default guard');
    mintArgs.tokenBurn = some({
      mint: defaultGuard.guards.tokenBurn.value.mint,
      amount: defaultGuard.guards.tokenBurn.value.amount,
    });
  }
  return mintArgs;
};

// build route instruction for allowlist guard
export const routeBuilder = async (
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
) => {
  let tx2 = transactionBuilder();

  if (guardToUse.guards.allowList.__option === "Some") {
    console.log(`Processing allowList guard for group: ${guardToUse.label}`);
    console.log('AllowList guard configuration:', JSON.stringify(guardToUse.guards.allowList, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2));
    
    const allowlist = allowLists.get(guardToUse.label);
    if (!allowlist) {
      console.error("allowlist not found!");
      return tx2;
    }
    
    const allowListProof = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard: candyMachine.mintAuthority,
      candyMachine: candyMachine.publicKey,
      merkleRoot: getMerkleRoot(allowlist),
      user: publicKey(umi.identity),
    });
    console.log("allowListProof", allowListProof);
    if (allowListProof === null) {
      console.log("null");
      tx2 = tx2.add(
        route(umi, {
          guard: "allowList",
          candyMachine: candyMachine.publicKey,
          candyGuard: candyMachine.mintAuthority,
          group:
            guardToUse.label === "default" ? none() : some(guardToUse.label),
          routeArgs: {
            path: "proof",
            merkleRoot: getMerkleRoot(allowlist),
            merkleProof: getMerkleProof(allowlist, publicKey(umi.identity)),
          },
        })
      );
    }
    return tx2;
  }
};

// combine transactions. return TransactionBuilder[]
export const combineTransactions = (
  umi: Umi,
  txs: TransactionBuilder[],
  tables: AddressLookupTableInput[]
) => {
  const returnArray: TransactionBuilder[] = [];
  let builder = transactionBuilder();

  // combine as many transactions as possible into one
  for (let i = 0; i <= txs.length - 1; i++) {
    const tx = txs[i];
    let oldBuilder = builder;
    builder = builder.add(tx);

    if (!builder.fitsInOneTransaction(umi)) {
      oldBuilder = oldBuilder.setAddressLookupTables(tables);
      returnArray.push(oldBuilder);
      builder = new TransactionBuilder();
      builder = builder.add(tx);
    }
    if (i === txs.length - 1) {
      returnArray.push(builder);
    }
  }
  return returnArray;
};

export const buildTx = async (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  nftMint: Signer,
  guardToUse:
    | GuardGroup<DefaultGuardSet>
    | {
        label: string;
        guards: undefined;
      },
  mintArgs: Partial<DefaultGuardSetMintArgs> | undefined,
  luts: AddressLookupTableInput[],
  latestBlockhash: BlockhashWithExpiryBlockHeight,
  units: number,
  buyBeer: boolean,
  splTokenBurn?: {
    tokenMint: string;
    amount: number;
  }
) => {
  // Log completo de los parámetros de construcción de la transacción
  console.log('BUILDING TRANSACTION:', JSON.stringify({
    candyMachinePublicKey: candyMachine.publicKey,
    collectionMint: candyMachine.collectionMint,
    guardLabel: guardToUse.label,
    guardHasGuards: !!guardToUse.guards,
    mintArgsKeys: mintArgs ? Object.keys(mintArgs) : [],
    candyGuardPublicKey: candyGuard.publicKey,
    computeUnits: units,
    buyBeer: buyBeer
  }, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, 2));
  let tx = transactionBuilder();

  // Prepare mintArgs with SPL token payment if specified
  let finalMintArgs = mintArgs ? { ...mintArgs } : {};
  
  // If splTokenBurn is provided, add it to mintArgs
  if (splTokenBurn) {
    console.log('Adding SPL token payment to mintArgs:', JSON.stringify(splTokenBurn));
    
    // Verificar que los parámetros son válidos
    try {
      const tokenMintPubkey = publicKey(splTokenBurn.tokenMint);
      const amount = BigInt(splTokenBurn.amount);
      
      finalMintArgs = {
        ...finalMintArgs,
        tokenBurn: some<TokenBurnArgs>({
          amount,
          mint: tokenMintPubkey,
        }),
      };
    } catch (error: any) {
      console.error('Error processing SPL token burn:', error);
      throw new Error(`Error processing SPL token burn: ${error?.message || 'Unknown'}`);
    }
  }

  tx = tx.add(
    mintV2(umi, {
      candyMachine: candyMachine.publicKey,
      collectionMint: candyMachine.collectionMint,
      collectionUpdateAuthority: candyMachine.authority,
      nftMint,
      group: guardToUse.label === "default" ? none() : some(guardToUse.label),
      candyGuard: candyGuard.publicKey,
      mintArgs: finalMintArgs,
      tokenStandard: candyMachine.tokenStandard,
    })
  );

  if (buyBeer) {
    tx = tx.prepend(
      transferSol(umi, {
        destination: publicKey("BeeryDvghgcKPTUw3N3bdFDFFWhTWdWHnsLuVebgsGSD"),
        amount: sol(0.005),
      })
    );
  }
  tx = tx.prepend(setComputeUnitLimit(umi, { units }));
  tx = tx.prepend(
    setComputeUnitPrice(umi, {
      microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001"),
    })
  );
  tx = tx.setAddressLookupTables(luts);
  tx = tx.setBlockhash(latestBlockhash);
  return tx.build(umi);
};

// simulate CU based on Sammys gist https://gist.github.com/stegaBOB/7c0cdc916db4524dd9c285f9e4309475
export const getRequiredCU = async (umi: Umi, transaction: Transaction) => {
  const defaultCU = 800_000;
  const web3tx = toWeb3JsTransaction(transaction);
  let connection = new Connection(umi.rpc.getEndpoint(), "finalized");
  const simulatedTx = await connection.simulateTransaction(web3tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });
  if (simulatedTx.value.err || !simulatedTx.value.unitsConsumed) {
    return defaultCU;
  }
  return simulatedTx.value.unitsConsumed * 1.2 || defaultCU;
};
