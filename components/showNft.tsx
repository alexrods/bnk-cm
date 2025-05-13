import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import { Box, Text, Divider, SimpleGrid, VStack, Center, Button } from "@chakra-ui/react";
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
      boxShadow="0 0 10px rgba(255, 0, 255, 0.4)"
      p={2}
      transition="all 0.3s ease"
      animation="color-shift 8s infinite linear"
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "0 0 15px rgba(0, 120, 255, 0.6)"
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
  console.log('Card component received metadata:', metadata);
  // Get the images from the metadata if animation_url is present use this
  if (!metadata) {
    return <Box p={4} textAlign="center">No NFT metadata available</Box>;
  }
  const image = metadata.animation_url ?? metadata.image;
  console.log('NFT image URL:', image);
  
  return (
    <Box 
      position={"relative"} 
      width={"full"} 
      overflow={"hidden"}
      borderRadius="lg"
      bg="rgba(0, 0, 0, 0.6)"
      p={{base: 2, sm: 3, md: 4}}
      transition="all 0.1s ease"
    >
      {image ? (
        <Box
          position="relative"
          borderRadius="md"
          borderWidth="2px"
          borderColor="var(--primary-color)"
          overflow="hidden"
          mb={4}
          textAlign="center"
          p={2}
          bg="black"
        >
          <img
            src={image}
            alt={metadata.name || "NFT Image"}
            style={{
              maxWidth: "100%",
              maxHeight: "300px",
              margin: "0 auto",
              display: "block"
            }}
            onError={(e) => {
              console.error('Error loading NFT image:', e);
              // Fallback to a placeholder image
              (e.target as HTMLImageElement).src = '/assets/nft-placeholder.png';
            }}
          />
        </Box>
      ) : (
        <Box
          height={{base: "200px", md: "300px"}}
          width="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="md"
          borderWidth="2px"
          borderColor="var(--primary-color)"
          boxShadow="0 0 15px rgba(255, 0, 255, 0.5)"
          mb={4}
          bg="rgba(0, 0, 0, 0.3)"
        >
          <Text color="var(--primary-color)" fontWeight="bold">
            Image not available
          </Text>
        </Box>
      )}
      <Text 
        fontWeight="bold" 
        fontSize={{base: "lg", md: "xl"}}
        marginTop={{base: "10px", md: "15px"}}
        color="var(--primary-color)"
      >
        {metadata.name}
      </Text>
      <Text 
        mt={{base: 1, md: 2}}
        color="white"
        fontSize={{base: "sm", md: "md"}}
        lineHeight="1.6"
      >
        {metadata.description ? (metadata.description.length > 150 ? metadata.description.substring(0, 150) + '...' : metadata.description) : ''}
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

  console.log('Rendering NFTs:', nfts);
  // Ya no necesitamos crear cards para Accordion
  console.log('Renderizando NFTs directamente:', nfts);
  return (
    <Box 
      p={{base: 2, sm: 3, md: 4}}
      borderRadius="xl" 
      bg="rgba(0, 0, 0, 0.4)" 
      borderWidth="2px"
      borderColor="var(--primary-color)"
    >
      <Text 
        fontSize={{base: "xl", md: "2xl"}} 
        fontWeight="bold" 
        mb={{base: 3, md: 6}}
        textAlign="center"
        color="var(--primary-color)"
      >
        Your Minted NFTs
      </Text>
      
      {/* Mostrando los NFTs directamente sin Accordion */}
      {nfts.map((nft) => (
        <Box key={nft.mint.toString()} mb={6}>
          <Card metadata={nft.offChainMetadata} />
        </Box>
      ))}
      
      <Center mt={8}>
        <Button
          as="a"
          href="https://bonkgames.io"
          target="_blank"
          rel="noopener noreferrer"
          size={{base: "md", md: "lg"}}
          height={{base: "50px", md: "60px"}}
          width={{base: "180px", md: "220px"}}
          fontFamily="'Press Start 2P', cursive"
          fontSize={{base: "sm", md: "lg"}}
          fontWeight="bold"
          letterSpacing="wide"
          bg="black"
          color="var(--primary-color)"
          borderWidth="2px"
          borderColor="var(--primary-color)"
          borderRadius="md"
          _hover={{
            bg: "rgba(0, 0, 0, 0.9)"
          }}
        >
          PLAY NOW
        </Button>
      </Center>
    </Box>
  );
};
