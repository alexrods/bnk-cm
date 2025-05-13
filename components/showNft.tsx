import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import { Box, Text, Divider, SimpleGrid, VStack } from "@chakra-ui/react";
import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";

interface TraitProps {
  heading: string;
  description: string;
}

interface TraitsProps {
  metadata: JsonMetadata;
}
const Trait = ({ heading, description }: TraitProps) => {
  return (
    <Box
      backgroundColor={"rgba(0, 0, 0, 0.7)"}
      borderRadius={"8px"}
      width={"120px"}
      minHeight={"70px"}
      borderWidth="1px"
      borderColor="var(--primary-color)"
      boxShadow="0 0 10px rgba(0, 255, 255, 0.2)"
      p={2}
      transition="all 0.3s ease"
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)"
      }}
    >
      <VStack spacing={1} justify="center" height="100%">
        <Text 
          fontSize={"sm"} 
          color="var(--primary-color)" 
          fontWeight="medium"
          textShadow="0 0 5px rgba(0, 255, 255, 0.3)"
        >
          {heading}
        </Text>
        <Text 
          fontSize={"sm"} 
          fontWeight={"bold"}
          color="white"
        >
          {description}
        </Text>
      </VStack>
    </Box>
  );
};

const Traits = ({ metadata }: TraitsProps) => {
  if (metadata === undefined || metadata.attributes === undefined) {
    return <></>;
  }

  //find all attributes with trait_type and value
  const traits = metadata.attributes.filter(
    (a) => a.trait_type !== undefined && a.value !== undefined
  );
  const traitList = traits.map((t) => (
    <Trait
      key={t.trait_type}
      heading={t.trait_type ?? ""}
      description={t.value ?? ""}
    />
  ));

  return (
    <>
      <Divider 
        marginTop={"20px"} 
        borderColor="var(--primary-color)" 
        opacity="0.5"
        boxShadow="0 0 5px rgba(0, 255, 255, 0.2)"
      />
      <Text 
        fontSize="lg" 
        fontWeight="bold" 
        mt={4} 
        mb={2} 
        color="var(--primary-color)"
        textShadow="0 0 8px rgba(0, 255, 255, 0.4)"
      >
        Attributes
      </Text>
      <SimpleGrid marginTop={"10px"} columns={{base: 2, md: 3}} spacing={5}>
        {traitList}
      </SimpleGrid>
    </>
  );
};

export default function Card({
  metadata,
}: {
  metadata: JsonMetadata | undefined;
}) {
  // Get the images from the metadata if animation_url is present use this
  if (!metadata) {
    return <></>;
  }
  const image = metadata.animation_url ?? metadata.image;
  return (
    <Box 
      position={"relative"} 
      width={"full"} 
      overflow={"hidden"}
      borderRadius="lg"
      bg="rgba(0, 0, 0, 0.6)"
      p={4}
      boxShadow="0 0 20px rgba(0, 255, 255, 0.2)"
      transition="all 0.3s ease"
      _hover={{
        boxShadow: "0 0 25px rgba(0, 255, 255, 0.3)"
      }}
    >
      <Box
        key={image}
        height={{base: "xs", md: "sm"}}
        position="relative"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        backgroundSize="cover"
        backgroundImage={`url(${image})`}
        borderRadius="md"
        borderWidth="2px"
        borderColor="var(--primary-color)"
        overflow="hidden"
        boxShadow="0 0 15px rgba(0, 255, 255, 0.3)"
        mb={4}
        transition="all 0.3s ease"
        _hover={{
          transform: "scale(1.02)",
          boxShadow: "0 0 20px rgba(0, 255, 255, 0.5)"
        }}
      />
      <Text 
        fontWeight="bold" 
        fontSize="xl"
        marginTop={"15px"}
        color="var(--primary-color)"
        textShadow="0 0 8px rgba(0, 255, 255, 0.4)"
      >
        {metadata.name}
      </Text>
      <Text 
        mt={2} 
        color="white"
        fontSize="md"
        lineHeight="1.6"
      >
        {metadata.description}
      </Text>
      <Traits metadata={metadata} />
    </Box>
  );
}

type Props = {
  nfts:
    | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
    | undefined;
};

export const ShowNft = ({ nfts }: Props) => {
  if (nfts === undefined) {
    return <></>;
  }

  const cards = nfts.map((nft, index) => (
    <AccordionItem 
      key={nft.mint + "Accordion"}
      borderWidth="2px"
      borderColor="var(--primary-color)" 
      borderRadius="lg"
      mb={4}
      bg="rgba(0, 0, 0, 0.7)"
      overflow="hidden"
      boxShadow="0 0 15px rgba(0, 255, 255, 0.2)"
      transition="all 0.3s ease"
      _hover={{
        boxShadow: "0 0 20px rgba(0, 255, 255, 0.4)"
      }}
    >
      <h2>
        <AccordionButton 
          p={4}
          bg="rgba(0, 0, 0, 0.8)"
          _hover={{
            bg: "rgba(0, 255, 255, 0.1)"
          }}
        >
          <Box 
            as="span" 
            flex="1" 
            textAlign="left"
            fontWeight="bold"
            fontSize="lg"
            color="var(--primary-color)"
            textShadow="0 0 5px rgba(0, 255, 255, 0.4)"
          >
            {nft.offChainMetadata?.name}
          </Box>
          <AccordionIcon color="var(--primary-color)" boxSize={6} />
        </AccordionButton>
      </h2>
      <AccordionPanel py={6} px={4}>
        <Card metadata={nft.offChainMetadata} key={nft.mint} />
      </AccordionPanel>
    </AccordionItem>
  ));
  return (
    <Box 
      p={4} 
      borderRadius="xl" 
      bg="rgba(0, 0, 0, 0.4)" 
      backdropFilter="blur(8px)"
      borderWidth="1px"
      borderColor="var(--primary-color)"
      boxShadow="0 0 25px rgba(0, 255, 255, 0.15)"
    >
      <Text 
        fontSize="2xl" 
        fontWeight="bold" 
        mb={6} 
        textAlign="center"
        color="var(--primary-color)"
        textShadow="0 0 10px rgba(0, 255, 255, 0.5)"
      >
        Your Minted NFTs
      </Text>
      <Accordion defaultIndex={[0]} allowMultiple={true}>
        {cards}
      </Accordion>
    </Box>
  );
};
