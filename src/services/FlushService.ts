import { query } from '../config/database';
import { TransferService } from './TransferService';
import { ChainAdapterFactory } from '../chains';
import { FlushRequest, ChainType } from '../types';
import { logger } from '../utils/logger';

export class FlushService {
    private transferService: TransferService;
    // Limit concurrent RPC calls to avoid rate-limiting
    private readonly CONCURRENCY_LIMIT = 5;

    constructor() {
        this.transferService = new TransferService();
    }

    /**
     * Flushes multiple user addresses to a hot wallet in parallel.
     */
    async flushToHotWallet(request: FlushRequest): Promise<string[]> {
        logger.info(`Starting flush for ${request.userAddresses.length} addresses on ${request.chain}`);

        // 1. Process addresses in chunks to prevent RPC/Node.js overload
        const txHashes: string[] = [];
        for (let i = 0; i < request.userAddresses.length; i += this.CONCURRENCY_LIMIT) {
            const chunk = request.userAddresses.slice(i, i + this.CONCURRENCY_LIMIT);

            const results = await Promise.all(
                chunk.map(address => this.processSingleAddressFlush(address, request))
            );

            // Filter out nulls from skipped/failed transfers
            txHashes.push(...results.filter((hash): hash is string => hash !== null));
        }

        return txHashes;
    }

    /**
     * Internal logic for a single address flush
     */
    private async processSingleAddressFlush(userAddress: string, request: FlushRequest): Promise<string | null> {
        try {
            // 1. Fetch address metadata to get the correct network
            const addrData = await query(
                `SELECT network, chain FROM addresses WHERE LOWER(address) = LOWER($1)`,
                [userAddress]
            );

            if (addrData.rows.length === 0) {
                logger.warn(`Flush skipped: Address ${userAddress} not found in DB`);
                return null;
            }

            const { network, chain } = addrData.rows[0];
            const adapter = ChainAdapterFactory.getAdapter(chain as ChainType, network);

            // 2. Get real-time balance
            const balanceStr = await adapter.getBalance(userAddress, request.token);
            const balance = parseFloat(balanceStr);

            // 3. Dynamic Fee Estimation
            const gasFee = await this.getDynamicGasFee(adapter, chain as ChainType, request.token);
            const minThreshold = gasFee * 2; // Only flush if we get at least 50% value after fees

            if (balance <= minThreshold) {
                return null;
            }

            // 4. Calculate final amount (subtract fee only if flushing native token)
            let amountToFlush = balance;
            if (!request.token) {
                amountToFlush = balance - gasFee;
            }

            // 5. Execute Transfer
            const txHash = await this.transferService.transfer({
                fromAddress: userAddress,
                toAddress: request.hotWalletAddress,
                amount: amountToFlush.toString(),
                chain: chain as ChainType,
                token: request.token,
            });

            return txHash;

        } catch (error: any) {
            logger.error(`Flush error for ${userAddress}: ${error.message}`);
            return null;
        }
    }

    private async getDynamicGasFee(adapter: any, chain: ChainType, isToken: string | undefined): Promise<number> {
        try {
            const feeData = await adapter.getGasPrice();
            const gasUnits = isToken ? 65000 : 21000;
            return (Number(feeData) * gasUnits) / 1e18;
        } catch (error) {
            logger.warn(`Failed to get dynamic gas fee for chain ${chain}: ${error}`);
            return 0.001;
        }
    }

    async scheduleAutoFlush(chain: ChainType, intervalMinutes: number = 60) {
        const run = async () => {
            logger.info(`--- Triggering Scheduled Flush for ${chain} ---`);
            await this.executeInternalFlush(chain);
            setTimeout(run, intervalMinutes * 60 * 1000);
            logger.info(`--- Scheduled Flush Finished. Next run in ${intervalMinutes}m ---`);
        };

        run();
    }

    private async executeInternalFlush(chain: ChainType) {
        try {
            // 1. Get Destination (Hot Wallet)
            const hwResult = await query(
                `SELECT address FROM hot_wallets WHERE chain = $1 AND is_active = true LIMIT 1`,
                [chain]
            );

            if (hwResult.rows.length === 0) {
                logger.warn(`Auto-flush aborted: No active hot wallet for ${chain}`);
                return;
            }

            const hotWalletAddress = hwResult.rows[0].address;

            // 2. Get Targets (All User Addresses for this chain)
            const addrResult = await query(
                `SELECT address FROM addresses WHERE chain = $1`,
                [chain]
            );

            const userAddresses = addrResult.rows.map(r => r.address);

            if (userAddresses.length === 0) {
                logger.info(`No addresses found to check for ${chain}`);
                return;
            }

            // 3. Hand off to the main processing method
            await this.flushToHotWallet({
                userAddresses,
                hotWalletAddress,
                chain
            });

        } catch (error: any) {
            logger.error(`Critical error during executeInternalFlush for ${chain}: ${error.message}`);
        }
    }
}