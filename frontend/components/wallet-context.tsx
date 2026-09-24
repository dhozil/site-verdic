"use client";

import { createContext, useContext } from "react";
import type { WalletProvider } from "@/lib/wallets";

export interface WalletState {
  account: string | null;
  provider: WalletProvider | null;
  walletLabel: string | null;
  connecting: boolean;
  openPicker: () => void;
}

export const WalletContext = createContext<WalletState>({
  account: null,
  provider: null,
  walletLabel: null,
  connecting: false,
  openPicker: () => {},
});

export const useWallet = () => useContext(WalletContext);
