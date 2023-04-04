import { initializeKeypair } from "./initializeKeypair"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import {Metaplex,keypairIdentity,bundlrStorage,toMetaplexFile,} from "@metaplex-foundation/js"
import {DataV2,createCreateMetadataAccountV2Instruction,createUpdateMetadataAccountV2Instruction,} from "@metaplex-foundation/mpl-token-metadata"
import * as fs from "fs"

// --------------------------------------------- Token Mint Account Creation-----------------------------------------------------------------

async function createNewMint(
   connection : web3.Connection,
   payer : web3.Keypair,
   mintAuthority : web3.PublicKey,
   freezeAuthority : web3.PublicKey,
   decimals :number
) : Promise<web3.PublicKey> {
  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );

  console.log(`The token mint account address is ${tokenMint}`)
  console.log(
      `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
  );

  return tokenMint
}
// --------------------------------------------- Token Mint Account Creation-----------------------------------------------------------------

// ---------------------------------------------Associated Token Account Creation----------------------------------------------------------
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      owner
  )
  
  console.log(
      `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
  )

  return tokenAccount
}
// ---------------------------------------------Associated Token Account Creation----------------------------------------------------------


// ---------------------------------------------Mint Function -----------------------------------------------------------------

async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount * 10 ** mintInfo.decimals
  )

  console.log(
    `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
// ---------------------------------------------Mint Function -----------------------------------------------------------------

// ---------------------------------------------Metadata Creation-----------------------------------------------------------------
async function createTokenMetadata(
  connection : web3.Connection,
  metaplex: Metaplex,
  mint : web3.PublicKey,
  user: web3.Keypair,
  name: string,
  symbol: string,
  description: string
){
  const buffer = fs.readFileSync("./assets/glasscoin.png")
  const file = toMetaplexFile(buffer, "glasscoin.png")

  const imageUri = await metaplex.storage().upload(file)
  console.log("image uri:", imageUri)

  const { uri } = await metaplex
    .nfts()
    .uploadMetadata({
      name: name,
      description: description,
      image: imageUri,
    })
 
  console.log("metadata uri:", uri)

  const metadataPDA = metaplex.nfts().pdas().metadata({mint})

  const tokenMetadata = {
    name: name,
    symbol: symbol,
    uri: uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  } as DataV2

  const transaction = new web3.Transaction().add(
    createCreateMetadataAccountV2Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: user.publicKey,
        payer: user.publicKey,
        updateAuthority: user.publicKey,
      },
      {
        createMetadataAccountArgsV2: {
          data: tokenMetadata,
          isMutable: true,
        },
      }
    )
  )

  // send transaction
  const transactionSignature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [user]
  )

  console.log(
    `Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}

// ---------------------------------------------Metadata Creation-----------------------------------------------------------------

async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  console.log("PublicKey:", user.publicKey.toBase58())

  const mint = await createNewMint(
    connection,
    user,           // We'll pay the fees
    user.publicKey, // We're the mint authority
    user.publicKey, // And the freeze authority >:)
    2               // Only two decimals!
  )

  const tokenAccount = await createTokenAccount(
    connection,     
    user,           
    mint,            
    user.publicKey   // Associating our address with the token account
  )
  
  // Mint 100 tokens to our address
  await mintTokens(connection, user, mint, tokenAccount.address, user, 100)

  const MINT_ADDRESS = "";

  // metaplex setup
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      })
    )
  
  // Calling the token 
  await createTokenMetadata(
    connection,
    metaplex,
    new web3.PublicKey(MINT_ADDRESS),
    user,
    "GlassCoin", // Token name - REPLACE THIS WITH YOURS
    "GLS",     // Token symbol - REPLACE THIS WITH YOURS
    "To Chew Glasses and more :>" // Token description - REPLACE THIS WITH YOURS
  )
}


main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
