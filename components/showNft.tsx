import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import { Box, Text, Divider, SimpleGrid, VStack, Center, Button, Skeleton, Fade } from "@chakra-ui/react";
import React, { useMemo, memo } from "react";
import Image from "next/image";
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

// Componente Trait
const Trait = memo(({ heading, description }: TraitProps) => {
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
});

// Componente Traits
const Traits = memo(({ metadata }: TraitsProps) => {
  if (metadata === undefined || metadata.attributes === undefined) {
    return <></>;
  }

  // Encontrar todos los atributos con trait_type y value
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
});

// Componente LoadingCard para mostrar durante la carga de metadatos
const LoadingCard = () => {
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
      <Skeleton
        height={{base: "200px", md: "300px"}}
        width="100%"
        startColor="rgba(100, 100, 100, 0.3)"
        endColor="rgba(200, 200, 200, 0.3)"
        borderRadius="md"
        mb={4}
      />
      <Skeleton height="24px" width="70%" mb={2} />
      <Skeleton height="16px" width="90%" mb={1} />
      <Skeleton height="16px" width="80%" mb={3} />
      <Skeleton height="120px" width="100%" />
    </Box>
  );
};

// Componente Card
const Card = memo(function Card({
  metadata,
  loading = false,
}: {
  metadata: JsonMetadata | undefined;
  loading?: boolean;
}) {
  // Siempre llamamos a los hooks al principio, antes de cualquier return
  // Usamos un valor por defecto empty string para evitar errores cuando metadata es undefined
  const image = useMemo(() => {
    if (!metadata) return "";
    return metadata.animation_url ?? metadata.image;
  }, [metadata]);
  
  // Si está cargando o no hay metadatos, mostramos un estado de carga
  if (loading || !metadata) {
    return loading ? <LoadingCard /> : <Box p={4} textAlign="center">No NFT metadata available</Box>;
  }
  
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
          <div style={{ position: 'relative', width: '100%', height: '300px' }}>
            <Image
              src={image}
              alt={metadata.name || "NFT Image"}
              fill
              style={{
                objectFit: 'contain',
                margin: '0 auto'
              }}
              onError={() => {
                console.error('Error loading NFT image');
              }}
            />
          </div>
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
});

// Definición de las propiedades para el componente ShowNft
type Props = {
  nfts:
    | { 
        mint: PublicKey; 
        offChainMetadata: JsonMetadata | undefined;
        loading?: boolean;
        error?: boolean;
      }[]
    | undefined;
};

// Función de componente base para ShowNft - rediseñado para evitar hooks condicionales
function ShowNftComponent({ nfts }: Props) {
  // Siempre llamamos a los hooks primero, sin importar si nfts existe o no
  // Usar operador de optional chaining para manejar el caso cuando nfts es undefined
  const nftCards = useMemo(() => {
    // Si no hay NFTs, devolvemos un array vacío
    if (!nfts || nfts.length === 0) return [];
    
    // Si hay NFTs, mapeamos cada uno a un componente Card
    return nfts.map((nft) => (
      <Fade in={true} key={nft.mint.toString()}>
        <Box mb={6}>
          <Card 
            metadata={nft.offChainMetadata} 
            loading={nft.loading === true} 
          />
        </Box>
      </Fade>
    ));
  }, [nfts]);
  
  // Si no hay NFTs o el array está vacío, mostramos un contenedor vacío
  if (!nfts || nfts.length === 0 || nftCards.length === 0) {
    return <></>;
  }

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
      
      {/* Mostrando los NFTs memoizados */}
      {nftCards}
      
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
}

// Memoizamos el componente y exportamos
export const ShowNft = memo(ShowNftComponent);

// Asignamos displayName para evitar errores de ESLint
Trait.displayName = 'Trait';
Traits.displayName = 'Traits';
Card.displayName = 'Card';
ShowNft.displayName = 'ShowNft';

// Exportamos ShowNft como default
export default ShowNft;
