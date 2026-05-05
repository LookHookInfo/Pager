import { createThirdwebClient } from "thirdweb";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

export const HASH_TOKEN_ADDRESS = "0xA9B631ABcc4fd0bc766d7C0C8fCbf866e2bB0445";
