export enum ChainType {
  EVM = 'EVM',
  BITCOIN = 'BITCOIN',
  SOLANA = 'SOLANA',
  TON = 'TON'
}

export interface WalletConfig {
  userId: string;
  chains: ChainType[];
}

export interface GeneratedWallet {
  userId: string;
  mnemonic: string; // encrypted
  addresses: ChainAddress[];
}

export interface ChainAddress {
  chain: ChainType;
  network: string;
  address: string;
  derivationPath: string;
  publicKey: string;
}

export interface TransferRequest {
  fromAddress: string;
  toAddress: string;
  amount: string;
  chain: ChainType;
  token?: string;
}

export interface FlushRequest {
  userAddresses: string[];
  hotWalletAddress: string;
  chain: ChainType;
  token?: string;
}
