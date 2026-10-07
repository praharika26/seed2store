// Deploys Seed2StoreNFT (crop certificates + auctions + direct purchase) and wires it into .env.local.
//
//   Local:    npm run chain   (terminal 1)   then   npm run deploy:local
//   Sepolia:  put DEPLOYER_PRIVATE_KEY (a funded testnet key) in .env.local, then npm run deploy:sepolia
//
const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

const SEPOLIA = 11155111
// Testnet ETH comes from faucets in small amounts, so on Sepolia lots are priced at a demo rate:
// $67,200 ≈ 0.013 ETH. Mainnet-like behaviour (2500 USD/ETH) stays the default everywhere else.
const TESTNET_ETH_USD = 5_000_000

function upsertEnv(file, entries) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${key}=.*$`, "m")
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`
  }
  fs.writeFileSync(file, text)
}

/** Sourcify API v2: submit the exact compiler input, then poll until the job completes. */
async function verifyOnSourcify(chainId, address, creationTx) {
  const buildInfo = await hre.artifacts.getBuildInfo("contracts/Seed2StoreNFT.sol:Seed2StoreNFT")
  const res = await fetch(`https://sourcify.dev/server/v2/verify/${chainId}/${address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "seed2store-deploy/1.0" },
    body: JSON.stringify({
      stdJsonInput: buildInfo.input,
      compilerVersion: buildInfo.solcLongVersion,
      contractIdentifier: "contracts/Seed2StoreNFT.sol:Seed2StoreNFT",
      creationTransactionHash: creationTx,
    }),
  })
  const { verificationId, message } = await res.json()
  if (!verificationId) throw new Error(message || `Sourcify returned ${res.status}`)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const job = await (await fetch(`https://sourcify.dev/server/v2/verify/${verificationId}`)).json()
    if (job.isJobCompleted) {
      if (job.contract?.match) return console.log(`✓ Source verified on Sourcify (${job.contract.match})`)
      throw new Error(job.error?.message || "Sourcify could not match the bytecode")
    }
  }
  throw new Error("Sourcify verification still pending; check https://sourcify.dev later")
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in .env.local for this network.")
  const network = await hre.ethers.provider.getNetwork()
  const chainId = Number(network.chainId)
  const balance = await hre.ethers.provider.getBalance(deployer.address)

  console.log(`\nDeploying Seed2StoreNFT to ${hre.network.name} (chain ${chainId})`)
  console.log(`  deployer  ${deployer.address}`)
  console.log(`  balance   ${hre.ethers.formatEther(balance)} ETH`)
  if (balance === 0n) throw new Error(`The deployer has no ETH on ${hre.network.name}. Fund ${deployer.address} first.`)

  const Factory = await hre.ethers.getContractFactory("Seed2StoreNFT")
  const nft = await Factory.deploy()
  const tx = nft.deploymentTransaction()
  console.log(`  tx        ${tx && tx.hash}  (waiting to be mined…)`)
  await nft.waitForDeployment()
  const address = await nft.getAddress()
  const receipt = tx ? await tx.wait() : null
  const deployBlock = receipt ? receipt.blockNumber : 0

  console.log(`  contract  ${address}`)
  console.log(`  block     ${deployBlock}`)

  const deploymentsDir = path.join(__dirname, "..", "deployments")
  fs.mkdirSync(deploymentsDir, { recursive: true })
  fs.writeFileSync(
    path.join(deploymentsDir, `${hre.network.name}.json`),
    JSON.stringify(
      {
        network: hre.network.name,
        chainId,
        deployer: deployer.address,
        Seed2StoreNFT: { address, transactionHash: tx && tx.hash, blockNumber: deployBlock },
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  const isSepolia = chainId === SEPOLIA
  // The in-process "hardhat" network vanishes when this script exits; never point the app at it.
  if (hre.network.name === "hardhat") {
    console.log("\nIn-process network: .env.local left untouched. Use --network localhost or --network sepolia.\n")
    return
  }
  const rpcUrl = hre.network.config.url || "http://127.0.0.1:8545"
  upsertEnv(path.join(__dirname, "..", ".env.local"), {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_NFT_CONTRACT: address,
    NEXT_PUBLIC_DEPLOY_BLOCK: deployBlock,
    ...(isSepolia
      ? { NEXT_PUBLIC_CHAIN_NAME: "Sepolia", NEXT_PUBLIC_EXPLORER_URL: "https://sepolia.etherscan.io", NEXT_PUBLIC_ETH_USD: TESTNET_ETH_USD }
      : {}),
  })
  console.log(`\n.env.local updated (contract, chain, RPC, deploy block${isSepolia ? ", explorer, testnet price rate" : ""}).`)

  if (isSepolia) {
    console.log(`\nEtherscan: https://sepolia.etherscan.io/address/${address}`)
    console.log("Verifying source on Sourcify (Etherscan shows Sourcify-verified code)…")
    try {
      await verifyOnSourcify(chainId, address, tx.hash)
    } catch (e) {
      console.log(`Verification skipped: ${e.message.split("\n")[0]}`)
    }
  }
  console.log(`\nRestart \`npm run dev\` so Next.js picks up the new contract.\n`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
