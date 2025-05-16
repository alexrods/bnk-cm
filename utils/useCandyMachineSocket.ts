import { useState, useEffect, useCallback } from 'react';
import { Umi, PublicKey, publicKey } from '@metaplex-foundation/umi';
import { CandyMachine, CandyGuard, fetchCandyMachine, safeFetchCandyGuard } from '@metaplex-foundation/mpl-candy-machine';
import { useToast } from '@chakra-ui/react';

export interface CandyMachineState {
  candyMachine: CandyMachine | null;
  candyGuard: CandyGuard | null;
  itemsRemaining: number;
  itemsAvailable: number;
  itemsRedeemed: number;
  isLoading: boolean;
  error: Error | null;
  refreshCandyMachineState?: () => void;
}

export const useCandyMachineSocket = (
  umi: Umi,
  candyMachineId: string | undefined
) => {
  const [state, setState] = useState<CandyMachineState>({
    candyMachine: null,
    candyGuard: null,
    itemsRemaining: 0,
    itemsAvailable: 0,
    itemsRedeemed: 0,
    isLoading: true,
    error: null,
  });
  const toast = useToast();

  // Función para actualizar los datos de la Candy Machine
  const fetchCandyMachineData = useCallback(async () => {
    if (!candyMachineId || !umi) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Fetch Candy Machine data
      const cmPublicKey = publicKey(candyMachineId);
      const candyMachine = await fetchCandyMachine(umi, cmPublicKey);
      
      // Fetch Candy Guard data
      let candyGuard = null;
      try {
        candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
      } catch (e) {
        // console.error('Error fetching candy guard:', e);
      }

      // Calculate items remaining
      const itemsAvailable = Number(candyMachine.data.itemsAvailable);
      // Accedemos a itemsRedeemed que es la propiedad correcta en la versión actual de la API
      const itemsRedeemed = Number(candyMachine.itemsRedeemed);
      const itemsRemaining = itemsAvailable - itemsRedeemed;

      // console.log('Candy Machine actualizada:', {
      //   itemsAvailable,
      //   itemsRedeemed,
      //   itemsRemaining
      // });

      setState({
        candyMachine,
        candyGuard,
        itemsRemaining,
        itemsAvailable,
        itemsRedeemed,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching candy machine data:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error as Error 
      }));
    }
  }, [umi, candyMachineId, toast]);

  // Cargar los datos iniciales de la Candy Machine
  useEffect(() => {
    if (!candyMachineId || !umi) return;

    // Fetch initial data
    fetchCandyMachineData();
  }, [umi, candyMachineId, fetchCandyMachineData]);

  // Función para forzar una actualización manual
  const refreshCandyMachineState = useCallback(() => {
    fetchCandyMachineData();
  }, [fetchCandyMachineData]);

  return {
    ...state,
    refreshCandyMachineState
  };
};
