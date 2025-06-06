import {
  PublicKey,
  publicKey,
  Umi,
} from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import dynamic from "next/dynamic";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useUmi } from "../utils/useUmi";
import { CandyGuard, CandyMachine, AccountVersion } from "@metaplex-foundation/mpl-candy-machine"
import { useCandyMachineSocket } from "../utils/useCandyMachineSocket"
import styles from "../styles/Home.module.css";
import { guardChecker } from "../utils/checkAllowed";
import { Center, Card, CardHeader, CardBody, StackDivider, Heading, Stack, useToast, Text, Skeleton, useDisclosure, Button, Modal, ModalBody, ModalCloseButton, ModalContent, Image, ModalHeader, ModalOverlay, Box, Divider, VStack, Flex } from '@chakra-ui/react';
import { ButtonList } from "../components/mintButton";
import { GuardReturn } from "../utils/checkerHelper";
import { ShowNft } from "../components/showNft";
import { InitializeModal } from "../components/initializeModal";
import { image, headerText } from "../settings";
import { useSolanaTime } from "@/utils/SolanaTimeContext";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const useCandyMachine = (
  umi: Umi,
  candyMachineId: string,
  checkEligibility: boolean,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  firstRun: boolean,
  setfirstRun: Dispatch<SetStateAction<boolean>>
) => {
  const toast = useToast();
  
  // Usar el nuevo hook de WebSocket para mantener actualizados los datos de la Candy Machine
  const {
    candyMachine,
    candyGuard,
    itemsRemaining,
    itemsAvailable,
    itemsRedeemed,
    isLoading,
    error,
    refreshCandyMachineState
  } = useCandyMachineSocket(umi, candyMachineId);

  useEffect(() => {
    if (error) {
      console.error("Error fetching candy machine data:", error);
      toast({
        id: "cm-error",
        title: "Error al cargar la Candy Machine",
        description: error.message,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    }
  }, [error, toast]);

  useEffect(() => {
    if (candyMachine && candyGuard && firstRun) {
      setfirstRun(false);
    }
  }, [candyMachine, candyGuard, firstRun, setfirstRun]);

  // Verificar versión de la Candy Machine
  useEffect(() => {
    if (candyMachine && candyMachine.version !== AccountVersion.V2) {
      toast({
        id: "wrong-account-version",
        title: "Wrong candy machine account version!",
        description: "Please use latest sugar to create your candy machine. Need Account Version 2!",
        status: "error",
        duration: 999999,
        isClosable: true,
      });
    }
  }, [candyMachine, toast]);

  // Actualizar los datos cuando cambie checkEligibility
  useEffect(() => {
    if (checkEligibility) {
      refreshCandyMachineState();
    }
  }, [checkEligibility, refreshCandyMachineState]);

  // Convertir los tipos null a undefined para mantener compatibilidad con el resto del código
  return { 
    candyMachine: candyMachine as CandyMachine | undefined, 
    candyGuard: candyGuard as CandyGuard | undefined,
    itemsRemaining,
    itemsAvailable,
    itemsRedeemed,
    isLoading,
    refreshCandyMachineState
  };
};


export default function Home() {
  const umi = useUmi();
  const solanaTime = useSolanaTime();
  const toast = useToast();
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey, offChainMetadata: JsonMetadata | undefined }[] | undefined>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([
    { label: "startDefault", allowed: false, maxAmount: 0 },
  ]);
  const [firstRun, setFirstRun] = useState(true);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);


  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!")
    if (!toast.isActive('no-cm')) {
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
    }
  }
  const candyMachineId: PublicKey = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    } else {
      console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
      return publicKey("11111111111111111111111111111111");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { candyMachine, candyGuard, itemsRemaining, itemsAvailable, itemsRedeemed, isLoading: cmIsLoading, refreshCandyMachineState } = useCandyMachine(
    umi,
    process.env.NEXT_PUBLIC_CANDY_MACHINE_ID || "",
    checkEligibility,
    setCheckEligibility,
    firstRun,
    setFirstRun
  );

  
  const checkEligibilityFunc = async () => {
    if (!candyMachine || !candyGuard || !checkEligibility || isShowNftOpen) {
      return;
    }
    setFirstRun(false);
    
    const { guardReturn, ownedTokens } = await guardChecker(
      umi, candyGuard, candyMachine, solanaTime
    );

    setOwnedTokens(ownedTokens);
    setGuards(guardReturn);
    setIsAllowed(false);

    let allowed = false;
    for (const guard of guardReturn) {
      if (guard.allowed) {
        allowed = true;
        break;
      }
    }

    setIsAllowed(allowed);
    setLoading(false);
  };

  useEffect(() => {
    checkEligibilityFunc();
    // On purpose: not check for candyMachine, candyGuard, solanaTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umi, checkEligibility, firstRun]);

  const PageContent = () => {
    return (
      <>
        <style jsx global>
          {`
              body {
                  background: #2d3748; 
              }
          `}
        </style>
        <Card bg="rgba(20, 25, 45, 0.92)" border="1px solid var(--primary-color)" boxShadow="0 0 15px rgba(0, 255, 255, 0.3)" borderRadius="xl">
          <CardHeader>
            <Flex minWidth='max-content' alignItems='center' gap='2'>
              <Box width="100%" textAlign="center">
                <h1 className="bonk-games-logo" data-text={headerText}>{headerText}</h1>
              </Box>
              {loading ? (<></>) : (
                <Flex justifyContent="flex-end" marginLeft="auto">
                  <Box background="rgba(0, 0, 0, 0.7)" borderRadius="5px" minWidth="50px" minHeight="50px" p={2} border="1px solid var(--primary-color)" boxShadow="0 0 10px rgba(0, 255, 255, 0.4)">
                    <VStack >
                      <Text fontSize={"sm"} color="var(--primary-color)" textShadow="0 0 5px rgba(0, 255, 255, 0.7)" className="bonk-retro">
                        Available NFTs:
                      </Text>
                      <Text fontWeight={"semibold"} color="white" textShadow="0 0 10px rgba(0, 255, 255, 0.9)" className="bonk-heading">
                        {Number(candyMachine?.data.itemsAvailable) - Number(candyMachine?.itemsRedeemed)}/{Number(candyMachine?.data.itemsAvailable)}
                      </Text>
                    </VStack>
                  </Box>
                </Flex>
              )}
            </Flex>
          </CardHeader>

          <CardBody>
            <Flex flexDirection={"column"} gap={{base: 5, md: 10}}>
              <Center height={{base: 250, md: 300}}>
                <Box
                  rounded={'lg'}
                  pos={'relative'}
                  bg="rgba(0, 0, 0, 0.7)"
                  p={3}
                  borderRadius="lg"
                  border="1px solid var(--primary-color)"
                  boxShadow="0 0 15px rgba(0, 255, 255, 0.4)"
                  _before={{
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 0, 255, 0.1) 100%)',
                    borderRadius: 'lg',
                    pointerEvents: 'none',
                  }}
                >
                  <Image
                    rounded={'lg'}
                    height={300}
                    objectFit={'cover'}
                    alt={"project Image"}
                    src={image}
                    filter="drop-shadow(0 0 8px rgba(0, 255, 255, 0.5))"
                  />
                </Box>
              </Center>
              <Stack divider={<StackDivider />} spacing={{base: 4, md: 8}}>
                {loading ? (
                  <div>
                    <Divider my="10px" />
                    <Skeleton height="30px" my="10px" />
                    <Skeleton height="30px" my="10px" />
                    <Skeleton height="30px" my="10px" />
                  </div>
                ) : (
                  <ButtonList
                    guardList={guards}
                    candyMachine={candyMachine}
                    candyGuard={candyGuard}
                    umi={umi}
                    ownedTokens={ownedTokens}
                    setGuardList={setGuards}
                    mintsCreated={mintsCreated}
                    setMintsCreated={setMintsCreated}
                    onOpen={onShowNftOpen}
                    setCheckEligibility={setCheckEligibility}
                    checkEligibilityFunc={checkEligibilityFunc}
                    itemsRemaining={itemsRemaining}
                    itemsAvailable={itemsAvailable}
                    itemsRedeemed={itemsRedeemed}
                    isLoading={cmIsLoading}
                    refreshCandyMachineState={refreshCandyMachineState}
                  />
                )}
              </Stack>
            </Flex>
          </CardBody>
        </Card >
        {umi.identity.publicKey === candyMachine?.authority ? (
          <>
            <Center>
              <Button backgroundColor={"red.200"} marginTop={"10"} onClick={onInitializerOpen}>Initialize Everything!</Button>
            </Center>
            <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
              <ModalOverlay />
              <ModalContent maxW="600px">
                <ModalHeader>Initializer</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  < InitializeModal umi={umi} candyMachine={candyMachine} candyGuard={candyGuard} />
                </ModalBody>
              </ModalContent>
            </Modal>

          </>)
          :
          (<></>)
        }

        <Modal isOpen={isShowNftOpen} onClose={onShowNftClose}>
          <ModalOverlay bg="rgba(0, 0, 0, 0.8)" />
          <ModalContent 
            bg="rgba(0, 0, 0, 0.9)" 
            borderWidth="2px" 
            borderColor="var(--primary-color)" 
            borderRadius="xl"
            maxW="85vw"
          >
            <ModalCloseButton 
              color="var(--primary-color)"
              bg="black" 
              borderWidth="1px" 
              borderColor="var(--primary-color)"
              size="md"
              mr={3}
              mt={3}
            />
            <ModalBody py={8} px={6}>
              {mintsCreated && mintsCreated.length > 0 ? (
                <ShowNft nfts={mintsCreated} />
              ) : (
                <Box textAlign="center" p={6}>
                  <Text color="var(--primary-color)" fontSize="lg" mb={4}>
                    No NFTs minted yet or failed to load NFT data
                  </Text>
                </Box>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
  };

  return (
    <main>
      <div className={styles.wallet}>
        <WalletMultiButtonDynamic />
      </div>

      <div className={styles.center}>
        <PageContent key="content" />
      </div>
    </main>
  );
}
