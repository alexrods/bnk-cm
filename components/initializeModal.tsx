import { createLutForCandyMachineAndGuard } from "../utils/createLutForCandyGuard";
import {
  Box,
  Button,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Text,
  UseToastOptions,
  VStack,
  createStandaloneToast,
} from "@chakra-ui/react";
import {
  CandyGuard,
  CandyMachine,
  getMerkleRoot,
  route,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  Umi,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  transferSol,
  addMemo,
  setComputeUnitPrice,
  setComputeUnitLimit,
} from "@metaplex-foundation/mpl-toolbox";
import React from "react";
import { useEffect, useState } from "react";
import { allowLists } from "@/allowlist";
import { getRequiredCU } from "@/utils/mintHelper";

// new function createLUT that is called when the button is clicked and which calls createLutForCandyMachineAndGuard and returns a success toast
const createLut =
  (
    umi: Umi,
    candyMachine: CandyMachine,
    candyGuard: CandyGuard,
    recentSlot: number
  ) =>
  async () => {
    let [builder, AddressLookupTableInput] =
      await createLutForCandyMachineAndGuard(
        umi,
        recentSlot,
        candyMachine,
        candyGuard
      );
    try {
      const latestBlockhash = (await umi.rpc.getLatestBlockhash()).blockhash;
      builder = builder.setBlockhash(latestBlockhash);

      builder = builder.prepend(
        setComputeUnitPrice(umi, { microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001") })
      );
      const requiredCu = await getRequiredCU(umi, builder.build(umi));
      builder = builder.prepend(
        setComputeUnitLimit(umi, { units: requiredCu })
      );
      const { signature } = await builder.sendAndConfirm(umi, {
        confirm: { commitment: "processed" },
        send: {
          skipPreflight: true,
        },
      });
      createStandaloneToast().toast({
        title: "LUT created",
        description: `LUT ${AddressLookupTableInput.publicKey} created. Add it to your .env NEXT_PUBLIC_LUT NOW! This UI does not work properly without it!`,
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    } catch (e) {
      createStandaloneToast().toast({
        title: "creating LUT failed!",
        description: `Error: ${e}`,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    }
  };

const initializeGuards =
  (umi: Umi, candyMachine: CandyMachine, candyGuard: CandyGuard) =>
  async () => {
    console.log(candyGuard.groups)
    if (!candyGuard.groups) {
      return;
    }
    candyGuard.groups.forEach(async (group) => {
      let builder = transactionBuilder();
      if (
        group.guards.freezeSolPayment.__option === "Some" ||
        group.guards.freezeTokenPayment.__option === "Some"
      ) {
        createStandaloneToast().toast({
          title: "FreezeSolPayment!",
          description: `Make sure that you ran sugar freeze initialize!`,
          status: "info",
          duration: 9000,
          isClosable: true,
        });
      }
      if (group.guards.allocation.__option === "Some") {
        builder = builder.add(
          route(umi, {
            guard: "allocation",
            candyMachine: candyMachine.publicKey,
            candyGuard: candyMachine.mintAuthority,
            group: some(group.label),
            routeArgs: {
              candyGuardAuthority: umi.identity,
              id: group.guards.allocation.value.id,
            },
          })
        );
      }
      if (builder.items.length > 0) {
        builder = builder.prepend(
          setComputeUnitPrice(umi, { microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001") })
        );
        const latestBlockhash = (await umi.rpc.getLatestBlockhash()).blockhash;
        builder = builder.setBlockhash(latestBlockhash);
        const requiredCu = await getRequiredCU(umi, builder.build(umi));
        builder = builder.prepend(
          setComputeUnitLimit(umi, { units: requiredCu })
        );
        builder.sendAndConfirm(umi, {
          confirm: { commitment: "processed" },
          send: {
            skipPreflight: true,
          },
        });
        createStandaloneToast().toast({
          title: `The routes for ${group.label} were created!`,
          status: "success",
          duration: 9000,
          isClosable: true,
        });
      } else {
        createStandaloneToast().toast({
          title: `Nothing to create here for group ${group.label}`,
          status: "info",
          duration: 9000,
          isClosable: true,
        });
      }
    });
  };

const buyABeer = (umi: Umi, amount: string) => async () => {
  amount = amount.replace(" SOL", "");

  let builder = transactionBuilder()
    .add(addMemo(umi, { memo: "🍻" }))
    .add(
      transferSol(umi, {
        destination: publicKey("CGacpojgdVcuUBZuFJqWu3eiEVcbXAxQcXXridgvFhRg"),
        amount: sol(Number(amount)),
      })
    );
  builder = builder.prepend(setComputeUnitPrice(umi, { microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001") }));
  const latestBlockhash = (await umi.rpc.getLatestBlockhash()).blockhash;
  builder = builder.setBlockhash(latestBlockhash);
  const requiredCu = await getRequiredCU(umi, builder.build(umi));
  builder = builder.prepend(setComputeUnitLimit(umi, { units: requiredCu }));
  try {
    await builder.sendAndConfirm(umi, {
      confirm: { commitment: "processed" },
      send: {
        skipPreflight: true,
      },
    });
    createStandaloneToast().toast({
      title: "Thank you! 🍻",
      description: `Lets have a 🍺 together!`,
      status: "success",
      duration: 9000,
      isClosable: true,
    });
  } catch (e) {
    console.error(e);
  }
};

function BuyABeerInput({
  value,
  setValue,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
}) {
  const format = (val: string) => val + " SOL";
  const parse = (val: string) => val.replace(/^\$/, "");

  return (
    <>
      <NumberInput
        mr="2rem"
        value={format(value)}
        onChange={(valueString) => setValue(parse(valueString))}
        step={0.5}
        precision={2}
        keepWithinRange={true}
        min={0}
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
    </>
  );
}

type Props = {
  umi: Umi;
  candyMachine: CandyMachine;
  candyGuard: CandyGuard | undefined;
};

export const InitializeModal = ({ umi, candyMachine, candyGuard }: Props) => {
  const [recentSlot, setRecentSlot] = useState<number>(0);
  const [amount, setAmount] = useState<string>("5");
  console.log(`modal ${candyMachine}`);
  console.log(`candyGuard ${candyGuard}`);
  console.log(`umi ${umi}`);
  useEffect(() => {
    (async () => {
      setRecentSlot(await umi.rpc.getSlot());
    })();
  }, [umi]);

  if (!candyGuard) {
    console.error("no guard defined!");
    return <></>;
  }

  //key value object with label and roots
  const roots = new Map<string, string>();

  allowLists.forEach((value, key) => {
    //@ts-ignore
    const root = getMerkleRoot(value).toString("hex");
    if (!roots.has(key)) {
      roots.set(key, root);
    }
  });

  //put each root into a <Text> element
  const rootElements = Array.from(roots).map(([key, value]) => {
    return (
      <Box 
        key={key} 
        p={2} 
        mb={2} 
        borderRadius="md" 
        bg="rgba(0, 0, 0, 0.4)"
        borderWidth="1px"
        borderColor="rgba(0, 255, 255, 0.2)"
        transition="all 0.3s ease"
        _hover={{
          bg: "rgba(0, 0, 0, 0.6)",
          borderColor: "var(--primary-color)",
          transform: "translateY(-2px)",
          boxShadow: "0 0 8px rgba(0, 255, 255, 0.3)"
        }}
      >
        <Text 
          fontWeight="semibold" 
          color="var(--primary-color)" 
          mb={1}
          textShadow="0 0 5px rgba(0, 255, 255, 0.3)"
        >
          {key}:
        </Text>
        <Text 
          color="white" 
          fontSize="sm" 
          fontFamily="monospace" 
          p={2} 
          bg="rgba(0, 0, 0, 0.5)" 
          borderRadius="sm"
          overflowX="auto"
        >
          {value}
        </Text>
      </Box>
    );
  });

  return (
    <>
      <VStack 
        spacing={6} 
        bg="rgba(0, 0, 0, 0.7)" 
        borderRadius="xl" 
        borderWidth="2px" 
        borderColor="var(--primary-color)" 
        p={6}
        boxShadow="0 0 20px rgba(0, 255, 255, 0.2)"
        backdropFilter="blur(8px)"
        animation="pulse-border 5s infinite alternate"
      >
        <HStack 
          spacing={4} 
          bg="rgba(0, 0, 0, 0.5)" 
          borderRadius="lg" 
          p={4} 
          w="100%"
          borderWidth="1px"
          borderColor="var(--primary-color)"
          transition="all 0.3s ease"
          _hover={{ boxShadow: "0 0 15px rgba(0, 255, 255, 0.3)" }}
        >
          <Button
            onClick={createLut(umi, candyMachine, candyGuard, recentSlot)}
            bg="var(--primary-color)"
            color="black"
            borderRadius="md"
            px={6}
            py={4}
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            border="2px solid var(--primary-color)"
            position="relative"
            overflow="hidden"
            transition="all 0.3s ease"
            boxShadow="0 0 10px rgba(0, 255, 255, 0.4)"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
              transition: "0.5s",
              zIndex: 0
            }}
            _hover={{
              transform: "translateY(-3px)",
              boxShadow: "0 0 15px rgba(0, 255, 255, 0.7)",
              bg: "white",
              color: "var(--primary-color)",
              textShadow: "0 0 5px rgba(0, 255, 255, 0.5)",
              _before: {
                left: "100%"
              }
            }}
          >
            Create LUT
          </Button>
          <Text color="var(--primary-color)" fontWeight="medium" textShadow="0 0 5px rgba(0, 255, 255, 0.3)">Reduces transaction size errors</Text>
        </HStack>
        
        <HStack 
          spacing={4} 
          bg="rgba(0, 0, 0, 0.5)" 
          borderRadius="lg" 
          p={4} 
          w="100%"
          borderWidth="1px"
          borderColor="var(--primary-color)"
          transition="all 0.3s ease"
          _hover={{ boxShadow: "0 0 15px rgba(0, 255, 255, 0.3)" }}
        >
          <Button 
            onClick={initializeGuards(umi, candyMachine, candyGuard)}
            bg="var(--primary-color)"
            color="black"
            borderRadius="md"
            px={6}
            py={4}
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            border="2px solid var(--primary-color)"
            position="relative"
            overflow="hidden"
            transition="all 0.3s ease"
            boxShadow="0 0 10px rgba(0, 255, 255, 0.4)"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
              transition: "0.5s",
              zIndex: 0
            }}
            _hover={{
              transform: "translateY(-3px)",
              boxShadow: "0 0 15px rgba(0, 255, 255, 0.7)",
              bg: "white",
              color: "var(--primary-color)",
              textShadow: "0 0 5px rgba(0, 255, 255, 0.5)",
              _before: {
                left: "100%"
              }
            }}
          >
            Initialize Guards
          </Button>
          <Text color="var(--primary-color)" fontWeight="medium" textShadow="0 0 5px rgba(0, 255, 255, 0.3)">Required for some guards</Text>
        </HStack>
        
        <HStack 
          spacing={4} 
          bg="rgba(0, 0, 0, 0.5)" 
          borderRadius="lg" 
          p={4} 
          w="100%"
          borderWidth="1px"
          borderColor="var(--secondary-color)"
          transition="all 0.3s ease"
          _hover={{ boxShadow: "0 0 15px rgba(0, 255, 68, 0.3)" }}
        >
          <BuyABeerInput value={amount} setValue={setAmount} />
          <Button 
            onClick={buyABeer(umi, amount)}
            bg="var(--secondary-color)"
            color="black"
            borderRadius="md"
            px={6}
            py={4}
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            border="2px solid var(--secondary-color)"
            position="relative"
            overflow="hidden"
            transition="all 0.3s ease"
            boxShadow="0 0 10px rgba(0, 255, 68, 0.4)"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
              transition: "0.5s",
              zIndex: 0
            }}
            _hover={{
              transform: "translateY(-3px)",
              boxShadow: "0 0 15px rgba(0, 255, 68, 0.7)",
              bg: "white",
              color: "var(--secondary-color)",
              textShadow: "0 0 5px rgba(0, 255, 68, 0.5)",
              _before: {
                left: "100%"
              }
            }}
          >
            Buy me a Beer 
          </Button>
        </HStack>
        
        {rootElements.length > 0 && (
          <Text 
            fontWeight="bold" 
            fontSize="xl" 
            color="var(--primary-color)" 
            textShadow="0 0 10px rgba(0, 255, 255, 0.4)"
            mt={4}
          >
            Merkle trees for your allowlist.tsx:
          </Text>
        )}
        
        {rootElements.length > 0 && (
          <Box 
            bg="rgba(0, 0, 0, 0.6)" 
            p={4} 
            borderRadius="md" 
            w="100%"
            borderWidth="1px"
            borderColor="var(--primary-color)"
            boxShadow="0 0 10px rgba(0, 255, 255, 0.2)"
          >
            {rootElements}
          </Box>
        )}
      </VStack>
    </>
  );
};