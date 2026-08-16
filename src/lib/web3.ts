import { createThirdwebClient } from "thirdweb";
import { MASCOTS_ABI } from "@/lib/contracts/mascots-abi";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

export const HASH_TOKEN_ADDRESS = "0xA9B631ABcc4fd0bc766d7C0C8fCbf866e2bB0445";
export const MASCOTS_CONTRACT_ADDRESS = "0xD67EFC8C562000a4d17155091B574d6A5BB91B31";

export { MASCOTS_ABI };
