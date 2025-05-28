import {
  CandyGuard,
  CandyMachine,
  mintV2,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  AddressLookupTableInput,
  KeypairSigner,
  PublicKey,
  Transaction,
  Umi,
  createBigInt,
  generateSigner,
  none,
  publicKey,
  signAllTransactions,
  sol,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  DigitalAsset,
  DigitalAssetWithToken,
  JsonMetadata,
  fetchDigitalAsset,
  fetchJsonMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  fetchAddressLookupTable,
  setComputeUnitPrice,
  setComputeUnitLimit,
  transferSol,
  transferTokens,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-toolbox";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  chooseGuardToUse,
  routeBuilder,
  mintArgsBuilder,
  GuardButtonList,
  buildTx,
  getRequiredCU,
} from "../utils/mintHelper";
import { GuardReturn } from "../utils/checkerHelper";
import { verifyTx } from "@/utils/verifyTx";
import { useSolanaTime } from "@/utils/SolanaTimeContext";
import { mintText } from "../settings";
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Skeleton,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  Tooltip,
  useToast,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  createStandaloneToast,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

// Extender la interfaz Window para permitir nuestras propiedades personalizadas
declare global {
  interface Window {
    solToastShown?: boolean;
    tokenToastShown?: boolean;
  }
}
import { Dispatch, SetStateAction, useEffect, useState } from "react";

// --------------------------------------------------
// Utilidades
// --------------------------------------------------
const safeErrorToString = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    // @ts-ignore – acceso defensivo
    return String((e as any).message);
  }
  return JSON.stringify(e);
};

// --------------------------------------------------
// Helper UI
// --------------------------------------------------
const updateLoadingText = (
  loadingText: string | undefined,
  guardList: GuardReturn[],
  label: string,
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>
) => {
  const idx = guardList.findIndex((g) => g.label === label);
  if (idx === -1) return;
  const next = [...guardList];
  next[idx].loadingText = loadingText;
  setGuardList(next);
};

const fetchNftMetadata = async (umi: Umi, mintAddress: string) => {
  try {
    // Obtener el NFT por su dirección
    const nft = await fetchDigitalAsset(umi, mintAddress as any);
    if (!nft) return null;
    
    // Si tiene JSON URI, obtener los metadatos
    if (nft.metadata.uri) {
      const response = await fetch(nft.metadata.uri);
      if (!response.ok) return null;
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return null;
  }
};

// --------------------------------------------------
// Mint handler
// --------------------------------------------------
const mintClick = async (
  umi: Umi,
  guard: GuardReturn,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  ownedTokens: DigitalAssetWithToken[],
  mintAmount: number,
  mintsCreated: { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[] | undefined,
  setMintsCreated: Dispatch<SetStateAction<{ mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[] | undefined>>,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  checkEligibilityFunc: () => void,
  refreshCandyMachineState?: () => void // Función para actualizar los datos de la Candy Machine
) => {
  await checkEligibilityFunc();
  const firstAvailableGuard = guardList.find((g) => g.allowed);
  if (!firstAvailableGuard) return;

  const guardToUse = chooseGuardToUse(firstAvailableGuard, candyGuard);
  // console.log("guardToUse", guardToUse);
  if (!guardToUse.guards) return;
  
  // Get the default guard for tokenBurn if needed
  const defaultGuard = {
    label: "default",
    guards: candyGuard.guards
  };
  // console.log("Default guard for potential tokenBurn:", defaultGuard);

  const buyBeer = process.env.NEXT_PUBLIC_BUYMARKBEER !== "false";

  try {
    // ----- UI: start loading ----------------------------------
    const idx = guardList.findIndex((g) => g.label === guardToUse.label);
    if (idx !== -1) {
      const next = [...guardList];
      next[idx].minting = true;
      setGuardList(next);
    }

    // ----- AllowList route (si aplica) -------------------------
    let routeBuild = await routeBuilder(umi, guardToUse, candyMachine);
    if (routeBuild && routeBuild.items.length) {
      createStandaloneToast().toast({
        title: "Allowlist detected – please sign first Tx",
        status: "info",
        duration: 1500,
        isClosable: true,
      });
      routeBuild = routeBuild
        .prepend(setComputeUnitPrice(umi, { microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1000") }))
        .setBlockhash(await umi.rpc.getLatestBlockhash({ commitment: "finalized" }));

      const signed = await routeBuild.buildAndSign(umi);
      const sig = await umi.rpc.sendTransaction(signed, { skipPreflight: true, maxRetries: 1, commitment: "finalized" });
      await verifyTx(umi, [sig], await umi.rpc.getLatestBlockhash({ commitment: "finalized" }), "finalized");
    }

    // ----- Lookup table ---------------------------------------
    const luts: AddressLookupTableInput[] = [];
    const lutEnv = process.env.NEXT_PUBLIC_LUT;
    if (lutEnv) luts.push(await fetchAddressLookupTable(umi, publicKey(lutEnv)));

    // ----- Build mint Txs -------------------------------------
    const latestBh = await umi.rpc.getLatestBlockhash({ commitment: "finalized" });
    const mintArgs = mintArgsBuilder(candyMachine, guardToUse, ownedTokens, defaultGuard);

    // Check if we have SPL token burn configuration
    let splTokenBurn;
    try {
      if (process.env.NEXT_PUBLIC_SPL_TOKEN_MINT && 
          process.env.NEXT_PUBLIC_SPL_TOKEN_AMOUNT) {
        
        // Validar que los valores son correctos
        const tokenMint = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT.trim();
        const amount = parseInt(process.env.NEXT_PUBLIC_SPL_TOKEN_AMOUNT.trim());
        
        if (isNaN(amount) || amount <= 0) {
          throw new Error(`La cantidad de tokens debe ser un número positivo: ${amount}`);
        }
        
        // console.log('Configuración de quemado SPL:', {
        //   tokenMint,
        //   amount
        // });
        
        splTokenBurn = {
          tokenMint,
          amount
        };
      }
    } catch (error: any) {
      // console.error('Error al configurar el pago con SPL token:', error);
      createStandaloneToast().toast({
        title: "Error de configuración",
        description: `Error en la configuración de pago con tokens: ${error?.message || 'Desconocido'}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // Primero simulamos para calcular CU requerido
    const simTx = await buildTx(
      umi, 
      candyMachine, 
      candyGuard, 
      generateSigner(umi), 
      guardToUse, 
      mintArgs, 
      luts, 
      latestBh, 
      1_400_000, 
      buyBeer,
      splTokenBurn
    );
    const requiredCu = await getRequiredCU(umi, simTx);

    const mintTxs: Transaction[] = [];
    const nftSigners: KeypairSigner[] = [];

    for (let i = 0; i < mintAmount; i++) {
      const nftMint = generateSigner(umi);
      nftSigners.push(nftMint);
      mintTxs.push(
        await buildTx(
          umi, 
          candyMachine, 
          candyGuard, 
          nftMint, 
          guardToUse, 
          mintArgs, 
          luts, 
          latestBh, 
          requiredCu, 
          buyBeer,
          splTokenBurn
        )
      );
    }
    if (!mintTxs.length) throw new Error("No mint tx built");

    updateLoadingText("Please sign", guardList, guardToUse.label, setGuardList);

    const signed = await signAllTransactions(
      mintTxs.map((tx, i) => ({ transaction: tx, signers: [umi.payer, nftSigners[i]] }))
    );

    // ----- Enviar ---------------------------------------------
    const sendPromises = signed.map((tx, i) =>
      umi.rpc
        .sendTransaction(tx, { skipPreflight: true, maxRetries: 1, commitment: "finalized" })
        .then((sig) => {
          // console.log(`Tx ${i + 1}:`, base58.deserialize(sig)[0]);
          return sig;
        })
    );
    const sigs = (await Promise.all(sendPromises)).filter(Boolean) as Uint8Array[];

    updateLoadingText("Finalizing", guardList, guardToUse.label, setGuardList);

    const okMints = await verifyTx(umi, sigs, latestBh, "finalized");

    // Mostramos un toast de éxito para el minteo completado
    createStandaloneToast().toast({
      title: "Mint successful!",
      description: `${okMints.length} NFT(s) minted successfully!`,
      status: "success",
      duration: 5000,
      isClosable: true,
    });

    // Actualizamos el texto de carga
    updateLoadingText("Loading NFT metadata...", guardList, guardToUse.label, setGuardList);
    
    // Mostramos un toast para la carga de metadatos
    const loadMetadataToast = createStandaloneToast().toast({
      title: "Loading NFT metadata",
      description: "Retrieving your NFT information... Please wait a moment.",
      status: "info",
      duration: null,
      isClosable: false,
    });
    
    // Actualizamos el contador de NFTs sin esperar la carga de metadatos
    if (refreshCandyMachineState) {
      refreshCandyMachineState();
    }
    
    // Cargamos los metadatos para todos los NFTs minteados de forma asíncrona pero NO mostramos
    // el resultado hasta que estén todos cargados, para evitar glitches visuales
    const loadNFTMetadata = async () => {
      try {
        // Cargamos los metadatos para todos los NFTs minteados
        const metadataPromises = okMints.map(mint => fetchNftMetadata(umi, mint));
        const metadataResults = await Promise.allSettled(metadataPromises);
        
        // Preparamos los NFTs con sus metadatos ya cargados
        const completeNfts = okMints.map((mint, index) => {
          // Usamos una sintaxis segura para acceder a 'value' solo cuando el status es 'fulfilled'
          const result = metadataResults[index];
          const metadata = result.status === 'fulfilled' 
            ? (result as PromiseFulfilledResult<any>).value 
            : null;
            
          return {
            mint,
            offChainMetadata: metadata,
            loading: false,
            error: result.status === 'rejected'
          };
        });
        
        // Una vez que tenemos todos los metadatos, actualizamos el estado de una sola vez
        setMintsCreated(completeNfts);
        
        // Y ahora mostramos el modal con todos los datos ya listos
        onOpen();
        
        // Cerramos el toast de carga de metadatos
        if (loadMetadataToast) {
          createStandaloneToast().toast.close(loadMetadataToast);
        }
        
        // Mostramos un toast de éxito para los metadatos
        createStandaloneToast().toast({
          title: "NFT ready",
          description: "Your NFT metadata has been loaded successfully!",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } catch (error) {
        console.error("Error loading metadata:", error);
        
        // Cerramos el toast de carga en caso de error
        if (loadMetadataToast) {
          createStandaloneToast().toast.close(loadMetadataToast);
        }
        
        // Mostramos un toast de advertencia
        createStandaloneToast().toast({
          title: "Metadata loading issue",
          description: "There was a problem loading your NFT metadata. You can try refreshing the page.",
          status: "warning",
          duration: 8000,
          isClosable: true,
        });
      }
    };
    
    // Ejecutamos la carga de metadatos
    loadNFTMetadata();
  } catch (e) {
    const msg = safeErrorToString(e);
    console.error("Minting failed:", msg);
    createStandaloneToast().toast({ title: "Mint failed", description: msg, status: "error", duration: 3000, isClosable: true });
  } finally {
    const idx = guardList.findIndex((g) => g.label === guardToUse.label);
    if (idx !== -1) {
      const next = [...guardList];
      next[idx].minting = false;
      setGuardList(next);
    }
    setCheckEligibility(true);
    updateLoadingText(undefined, guardList, guardToUse.label, setGuardList);
  }
};
// new component called timer that calculates the remaining Time based on the bigint solana time and the bigint toTime difference.
const Timer = ({
  solanaTime,
  toTime,
  setCheckEligibility,
}: {
  solanaTime: bigint;
  toTime: bigint;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
}) => {
  const [remainingTime, setRemainingTime] = useState<bigint>(
    toTime - solanaTime
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        return prev - BigInt(1);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  //convert the remaining time in seconds to the amount of days, hours, minutes and seconds left
  const days = remainingTime / BigInt(86400);
  const hours = (remainingTime % BigInt(86400)) / BigInt(3600);
  const minutes = (remainingTime % BigInt(3600)) / BigInt(60);
  const seconds = remainingTime % BigInt(60);
  if (days > BigInt(0)) {
    return (
      <Text fontSize="xl" fontWeight="bold" mb={2} color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.5)">
        {days.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        d{" "}
        {hours.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        h{" "}
        {minutes.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        m{" "}
        {seconds.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        s
      </Text>
    );
  }
  if (hours > BigInt(0)) {
    return (
      <Text fontSize="xl" fontWeight="bold" mb={2} color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.5)">
        {hours.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        h{" "}
        {minutes.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        m{" "}
        {seconds.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        s
      </Text>
    );
  }
  if (minutes > BigInt(0) || seconds > BigInt(0)) {
    return (
      <Text fontSize="xl" fontWeight="bold" mb={2} color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.5)">
        {minutes.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        m{" "}
        {seconds.toLocaleString("en-US", {
          minimumIntegerDigits: 2,
          useGrouping: false,
        })}
        s
      </Text>
    );
  }
  if (remainingTime === BigInt(0)) {
    setCheckEligibility(true);
  }
  return <Text></Text>;
};

type Props = {
  umi: Umi;
  guardList: GuardReturn[];
  candyMachine: CandyMachine | undefined;
  candyGuard: CandyGuard | undefined;
  ownedTokens: DigitalAssetWithToken[] | undefined;
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>;
  mintsCreated:
    | {
        mint: PublicKey;
        offChainMetadata: JsonMetadata | undefined;
      }[]
    | undefined;
  setMintsCreated: Dispatch<
    SetStateAction<
      | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
      | undefined
    >
  >;
  onOpen: () => void;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
  checkEligibilityFunc: () => void;
  // Nuevos props para el contador de NFTs
  itemsRemaining?: number;
  itemsAvailable?: number;
  itemsRedeemed?: number;
  isLoading?: boolean;
  // Función para actualizar manualmente los datos de la Candy Machine
  refreshCandyMachineState?: () => void;
};

export function ButtonList({
  umi,
  guardList,
  candyMachine,
  candyGuard,
  ownedTokens = [], // provide default empty array
  setGuardList,
  mintsCreated,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
  checkEligibilityFunc,
  // Nuevos props para el contador de NFTs
  itemsRemaining,
  itemsAvailable,
  itemsRedeemed,
  isLoading: cmIsLoading,
  refreshCandyMachineState,
}: Props): JSX.Element {
  const solanaTime = useSolanaTime();
  const [numberInputValues, setNumberInputValues] = useState<{
    [label: string]: number;
  }>({});
  
  // Movidos al principio para cumplir con las reglas de los Hooks
  const [solErrorToastShown, setSolErrorToastShown] = useState(false);
  const [tokenErrorToastShown, setTokenErrorToastShown] = useState(false);

  if (!candyMachine || !candyGuard) {
    return <></>;
  }

  const handleNumberInputChange = (label: string, value: number) => {
    setNumberInputValues((prev) => ({ ...prev, [label]: value }));
  };

  // remove duplicates from guardList
  let filteredGuardlist = guardList.filter(
    (elem, index, self) =>
      index === self.findIndex((t) => t.label === elem.label)
  );
  if (filteredGuardlist.length === 0) {
    return <></>;
  }
  // Guard "default" can only be used to mint in case no other guard exists
  if (filteredGuardlist.length > 1) {
    filteredGuardlist = guardList.filter((elem) => elem.label != "default");
  }

  // Find the first available guard
  const firstAvailableGuard = filteredGuardlist.find(guard => guard.allowed);
  
  // Vamos a verificar explícitamente si hay errores de balance en todas las guardias
  let hasSolPaymentError = false;
  let hasTokenPaymentError = false;
  let errorReasons: string[] = [];
  
  // Variables para almacenar la cantidad de SOL necesaria
  let requiredSolAmount = "";
  let detectedSolCost = false;
  
  // Revisar todas las guardias para detectar errores de balance
  filteredGuardlist.forEach(guard => {
    if (guard.reason) {
      errorReasons.push(guard.reason);
      console.log(`Guardia ${guard.label}: ${guard.reason}`);
      
      // Verificar cualquier error relacionado con SOL
      if (guard.reason.includes("SOL") || guard.reason.includes("sol")) {
        hasSolPaymentError = true;
      }
      
      // Verificar cualquier error relacionado con tokens - ampliamos los criterios de detección
      if (
        guard.reason.includes("token") || 
        guard.reason.includes("Token") ||
        guard.reason.includes("TICKET") ||
        guard.reason.includes("burn") ||
        guard.reason.includes("enough")
      ) {
        hasTokenPaymentError = true;
      }
    }
  });
  
  // Verificar si hay algún mensaje que indique "Please connect your wallet"
  const needsWalletConnection = filteredGuardlist.some(guard => 
    guard.reason === "Please connect your wallet to mint" || 
    (guard.reason && guard.reason.includes("connect"))
  );
  
  // Si hay guardias pero ninguna permitida, y la wallet está conectada,
  // verificamos los errores reales y solo forzamos si no hay errores detectados
  if (filteredGuardlist.length > 0 && !firstAvailableGuard && !needsWalletConnection) {
    // Revisar todos los mensajes de error para mejorar la detección
    filteredGuardlist.forEach(guard => {
      if (guard.reason) {
        console.log(`Checking guard reason: ${guard.reason}`);
        
        // Buscar cualquier mención a SOL o lamports
        if (
          guard.reason.includes("SOL") || 
          guard.reason.includes("sol") ||
          guard.reason.includes("lamport") ||
          guard.reason.includes("balance")
        ) {
          hasSolPaymentError = true;
        }
        
        // Buscar cualquier mención a tokens o quemado de tokens
        if (
          guard.reason.includes("token") || 
          guard.reason.includes("Token") ||
          guard.reason.includes("TICKET") ||
          guard.reason.includes("burn") ||
          guard.reason.includes("$")
        ) {
          hasTokenPaymentError = true;
        }
      }
    });
    
    // Si aún no se detectó ningún error específico, pero sabemos que algo falló,
    // asumimos que el problema es de SOL por defecto
    if (!hasSolPaymentError && !hasTokenPaymentError) {
      hasSolPaymentError = true;
    }
  }
  
  // Verificar si hay algún error de balance
  const hasBalanceError = hasSolPaymentError || hasTokenPaymentError;
  
  // El grupo se definirá más adelante
  
  // Si no hay guardia disponible, mostrar alertas apropiadas
  if (!firstAvailableGuard) {
    // Si la wallet no está conectada, no mostrar alertas de balance
    if (needsWalletConnection) {
      return <></>; // No mostrar nada si la wallet no está conectada
    }
    
    // Mostrar alertas para cada tipo de error
    if (hasBalanceError) {
      // Mostrar toast solo una vez durante esta renderización
      // if (hasSolPaymentError && !solErrorToastShown) {
      //   createStandaloneToast().toast({
      //     title: "Balance de SOL insuficiente",
      //     description: "No tienes suficiente SOL en tu wallet para realizar el mint.",
      //     status: "error",
      //     duration: 7000,
      //     isClosable: true,
      //     position: "top"
      //   });
        
      //   // Marcar toast como mostrado
      //   setSolErrorToastShown(true);
      // }
      
      // if (hasTokenPaymentError && !tokenErrorToastShown) {
      //   createStandaloneToast().toast({
      //     title: "Tokens $TICKET insuficientes",
      //     description: "No tienes suficientes tokens $TICKET en tu wallet para realizar el mint.",
      //     status: "error",
      //     duration: 7000,
      //     isClosable: true,
      //     position: "top"
      //   });
        
      //   // Marcar toast como mostrado
      //   setTokenErrorToastShown(true);
      // }
      
      // Mostrar un componente de alerta con los errores de balance
      return (
        <Box 
          paddingY={"5px"} 
          width="100%" 
          maxW="600px" 
          margin="0 auto"
          bg="rgba(0, 0, 0, 0.7)"
          borderRadius="lg"
          boxShadow="0 0 20px rgba(255, 0, 0, 0.5)"
          p={6}
          border="2px solid #FF5555"
        >
          {/* Si faltan ambos recursos, mostrar una alerta combinada */}
          {hasSolPaymentError || hasTokenPaymentError ? (
            <Alert status="error" variant="solid" mb={4} borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Insufficient balance for minting</AlertTitle>
                <AlertDescription>
                  You need both SOL and $TICKET tokens to mint:
                  <br /><br />
                  <strong>1.</strong> You need at least 1 $TICKET in your wallet.<br />
                  <Button 
                    as="a" 
                    href="https://raydium.io/swap/?inputMint=sol&outputMint=J624FiUP1MRLVqRf3CayoKc4W8XE473sMau7MFREQFKf"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    mt={2}
                    mb={2}
                    colorScheme="teal"
                    leftIcon={<ExternalLinkIcon />}
                  >
                    Buy $TICKET on Raydium
                  </Button>
                  <br />
                  <strong>2.</strong> {detectedSolCost ? (
                    <>You need at least <strong>{requiredSolAmount} SOL</strong> to cover the NFT cost plus transaction fees.</>
                  ) : (
                    <>You need enough SOL to cover the NFT cost and transaction fee. ~0.12 SOL</>
                  )}
                </AlertDescription>
              </Box>
            </Alert>
          ) : (
            <>
              {/* Si solo falta SOL */}
              {hasSolPaymentError && (
                <Alert status="error" variant="solid" mb={4} borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Balance of SOL insufficient</AlertTitle>
                    <AlertDescription>
                      {detectedSolCost ? (
                        <>You need at least <strong>{requiredSolAmount} SOL</strong> to cover the NFT cost plus transaction fees.</>
                      ) : (
                        <>You need enough SOL to cover the NFT cost and transaction fee. ~0.12 SOL</>
                      )}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
              
              {/* Si solo faltan tokens $TICKET */}
              {hasTokenPaymentError && (
                <Alert status="error" variant="solid" mb={4} borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Tokens $TICKET insuficientes</AlertTitle>
                    <AlertDescription>
                      You need at least 1 $TICKET in your wallet.
                      <br />
                      <Button 
                        as="a" 
                        href="https://raydium.io/swap/?inputMint=sol&outputMint=J624FiUP1MRLVqRf3CayoKc4W8XE473sMau7MFREQFKf"
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        mt={2}
                        colorScheme="teal"
                        leftIcon={<ExternalLinkIcon />}
                      >
                        Buy $TICKET on Raydium
                      </Button>
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </>
          )}
        </Box>
      );
    }
    
    // Si no hay errores de balance, simplemente no mostrar nada
    return <></>;
  }

  // Obtener el texto del settings.tsx en lugar de calcularlo desde la guard
  const text = mintText.find((elem) => elem.label === firstAvailableGuard.label);
  const group = candyGuard.groups.find((elem) => elem.label === firstAvailableGuard.label);
  let startTime = createBigInt(0);
  let endTime = createBigInt(0);
  let mintLimit = 1;
  
  if (group) {
    if (group.guards.startDate.__option === "Some") {
      startTime = group.guards.startDate.value.date;
    }
    if (group.guards.endDate.__option === "Some") {
      endTime = group.guards.endDate.value.date;
    }
    if (group?.guards.mintLimit.__option === "Some") {
      mintLimit = group?.guards.mintLimit.value.limit;
    }
    
    // Extraer el costo de SOL de las guardias
    if (group.guards.solPayment.__option === "Some") {
      const solPaymentGuard = group.guards.solPayment.value;
      const lamports = solPaymentGuard.lamports.basisPoints;
      const solAmount = Number(lamports) / 1000000000; // Convertir lamports a SOL
      requiredSolAmount = solAmount.toFixed(2); // Formatear a 2 decimales
      detectedSolCost = true;
      console.log(`SOL cost detected: ${requiredSolAmount} SOL`);
    }
    
    // Registrar información del grupo para depuración
    // console.log("Grupo:", group.label, "Guardas:", group.guards);
  }

  // Añadiendo el precio en SDF como precio adicional
  const tokenSdfPrice = "1 $TICKET";
  
  // Obtener el texto del precio de settings.tsx
  const solPriceText = text ? text.mintText : "mintText missing in settings.tsx";
  
  // Crear el texto combinado de precios
  const combinedPriceText = `${tokenSdfPrice} + ${solPriceText}`;
  
  const buttonGuard: GuardButtonList = {
    label: firstAvailableGuard.label,
    allowed: firstAvailableGuard.allowed,
    header: text ? text.header : "header missing in settings.tsx",
    mintText: solPriceText, // Mantener para compatibilidad
    tokenPriceText: combinedPriceText, // Ahora contiene la combinación de precios
    buttonLabel: text ? text.buttonLabel : "buttonLabel missing in settings.tsx",
    startTime,
    endTime,
    tooltip: firstAvailableGuard.reason,
    maxAmount: mintLimit
  };

  return (
    <Box 
      paddingY={"5px"} 
      width="100%" 
      maxW="600px" 
      margin="0 auto"
      bg="rgba(0, 0, 0, 0.7)"
      borderRadius="lg"
      boxShadow="0 0 20px rgba(0, 255, 255, 0.3)"
      p={6}
      border="2px solid var(--primary-color)"

    >
      <HStack spacing={4} mt={2} width="100%">
        {/* Timer Section */}
        <HStack justify="flex-end">
          <Flex justifyContent="space-between" alignItems="center" width="100%">
            {buttonGuard.endTime > createBigInt(0) &&
              buttonGuard.endTime - solanaTime > createBigInt(0) &&
              (!buttonGuard.startTime ||
                buttonGuard.startTime - solanaTime <= createBigInt(0)) && (
                <>
                  <Text fontSize="md" fontWeight="bold" color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.5)" marginRight={"2"} className="bonk-retro">
                    Ending in:{" "}
                  </Text>
                  <Timer
                    toTime={buttonGuard.endTime}
                    solanaTime={solanaTime}
                    setCheckEligibility={setCheckEligibility}
                  />
                </>
              )}
            {buttonGuard.startTime > createBigInt(0) &&
              buttonGuard.startTime - solanaTime > createBigInt(0) &&
              (!buttonGuard.endTime ||
                solanaTime - buttonGuard.endTime <= createBigInt(0)) && (
                <>
                  <Text fontSize="md" fontWeight="bold" color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.5)" marginRight={"2"} className="bonk-retro">
                    Starting in:{" "}
                  </Text>
                  <Timer
                    toTime={buttonGuard.startTime}
                    solanaTime={solanaTime}
                    setCheckEligibility={setCheckEligibility}
                  />
                </>
              )}
          </Flex>
        </HStack>

        {/* Mint Info Section */}
        <HStack 
          borderRadius="md" 
          overflow="hidden" 
          borderWidth={2} 
          borderColor="var(--primary-color)" 
          width="100%"
          bg="rgba(0, 0, 0, 0.7)"
          boxShadow="0 0 10px rgba(0, 255, 255, 0.3)"
          transition="all 0.3s ease"
          _hover={{
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)"
          }}
        >
          <Flex direction="column" gap={2}>
            {/* Header centrado arriba */}
            <Flex alignItems="center" justifyContent="center">
              <Text 
                fontSize="xl" 
                fontWeight="extrabold" 
                color="var(--primary-color)" 
                textShadow="0 0 5px rgba(0, 255, 255, 0.5)" 
                className="bonk-heading"
                textAlign="center"
                letterSpacing="wider"
              >
                {buttonGuard.header}
              </Text>
            </Flex>
            
            {/* Precio combinado abajo */}
            <Flex justifyContent="center" mt={1}>
              <Text 
                fontSize="md" 
                color="var(--secondary-color)" 
                fontWeight="bold"
                textShadow="0 0 5px rgba(0, 255, 68, 0.5)"
                padding="4px 10px"
                borderRadius="md"
                bg="rgba(0, 20, 10, 0.6)"
                className="bonk-title"
                textAlign="center"
              >
                {buttonGuard.tokenPriceText}
              </Text>
            </Flex>

            {/* Botón para conseguir $TICKET */}
            <Flex justifyContent="center" mt={2} mb={1}>
              <Button 
                as="a" 
                href="https://raydium.io/swap/?inputMint=sol&outputMint=J624FiUP1MRLVqRf3CayoKc4W8XE473sMau7MFREQFKf"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                colorScheme="teal"
                variant="outline"
                leftIcon={<ExternalLinkIcon />}
                boxShadow="0 0 10px rgba(0, 255, 255, 0.3)"
                _hover={{
                  bg: "rgba(0, 255, 255, 0.1)",
                  boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)",
                  transform: "translateY(-2px)"
                }}
              >
                Need a $TICKET?
              </Button>
            </Flex>
          </Flex>
        </HStack>

        {/* Mint Controls Section */}
        <VStack spacing={4} mt={2} width="100%" position="relative">
          {/* Efecto de brillo detrás del botón */}
          <Box
            position="absolute"
            width="100%"
            height="100%"
            borderRadius="md"
            zIndex="0"
            opacity="0.5"
            filter="blur(20px)"
            bg="rgba(0, 255, 255, 0.2)"
            pointerEvents="none"
          />
          {(process.env.NEXT_PUBLIC_MULTIMINT === "true" && buttonGuard.allowed) ? (
            <NumberInput
              value={numberInputValues[buttonGuard.label] || 1}
              min={1}
              max={1}
              size="lg"
              isDisabled={!buttonGuard.allowed}
              onChange={(valueAsString, valueAsNumber) =>
                handleNumberInputChange(buttonGuard.label, valueAsNumber)
              }
              borderColor="var(--primary-color)"
              borderWidth="2px"
              borderRadius="md"
              _hover={{
                borderColor: "var(--primary-color)",
                boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)"
              }}
            >
              <NumberInputField 
                bg="rgba(0, 0, 0, 0.7)" 
                color="white"
                textAlign="center"
                fontWeight="bold"
                _focus={{
                  borderColor: "var(--primary-color)",
                  boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)"
                }}
              />
              <NumberInputStepper>
                <NumberIncrementStepper 
                  bg="rgba(0, 255, 255, 0.2)"
                  color="white"
                  borderColor="var(--primary-color)"
                  _hover={{ bg: "var(--primary-color)", color: "black" }}
                />
                <NumberDecrementStepper 
                  bg="rgba(0, 255, 255, 0.2)"
                  color="white"
                  borderColor="var(--primary-color)"
                  _hover={{ bg: "var(--primary-color)", color: "black" }}
                />
              </NumberInputStepper>
            </NumberInput>
          ) : null}

          <Button
            onClick={() =>
              mintClick(
                umi,
                buttonGuard,
                candyMachine,
                candyGuard,
                ownedTokens,
                numberInputValues[buttonGuard.label] || 1,
                mintsCreated,
                setMintsCreated,
                guardList,
                setGuardList,
                onOpen,
                setCheckEligibility,
                checkEligibilityFunc,
                refreshCandyMachineState
              )
            } 
            key={buttonGuard.label}
            size="lg"
            bg="var(--primary-color)"
            color="black"
            height="70px"
            fontSize="xl"
            fontWeight="extrabold"
            textTransform="uppercase"
            letterSpacing="wider"
            className="bonk-retro"
            isDisabled={!buttonGuard.allowed}
            isLoading={
              guardList.find((elem) => elem.label === buttonGuard.label)
                ?.minting
            }
            loadingText={
              guardList.find((elem) => elem.label === buttonGuard.label)
                ?.loadingText
            }
            position="relative"
            boxShadow="0 0 15px rgba(0, 255, 255, 0.5)"
            border="2px solid var(--primary-color)"
            textShadow="0 0 3px rgba(0, 0, 0, 0.5)"
            zIndex="1"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
              transition: "0.5s",
              zIndex: -1
            }}
            _hover={{
              transform: "translateY(-3px)",
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.8)",
              bg: "white",
              color: "var(--primary-color)",
              textShadow: "0 0 5px rgba(0, 255, 255, 0.5)",
              _before: {
                left: "100%",
                transition: "0.5s"
              }
            }}
            _active={{
              transform: "translateY(1px)",
              boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)"
            }}
            _disabled={{
              opacity: 0.6,
              bg: "gray.700",
              color: "gray.400",
              boxShadow: "none",
              borderColor: "gray.600",
              cursor: "not-allowed"
            }}
            transition="all 0.3s ease"
            w="full"
          >
            {buttonGuard.buttonLabel}
          </Button>
        </VStack>
      </HStack>
    </Box>
  );
}
