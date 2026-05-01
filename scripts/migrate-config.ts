import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Agentvouch } from "../target/types/agentvouch";

const LEGACY_REPUTATION_CONFIG_LEN = 82;
const CURRENT_REPUTATION_CONFIG_LEN = 86;

type Options = {
  apply: boolean;
};

type ParsedConfig = {
  authority: PublicKey;
  minStake: bigint;
  disputeBond: bigint;
  minAuthorBondForFreeListing: bigint;
  slashPercentage: number;
  cooldownPeriod: bigint;
  stakeWeight: number;
  vouchWeight: number;
  longevityBonus: number;
  bump: number;
  legacyDisputePenalty?: number;
};

function printUsage(): never {
  console.error(`Usage:
  ts-node scripts/migrate-config.ts [--apply]

Notes:
  - Dry run is the default. Pass --apply to submit the migration transaction.
  - Requires ANCHOR_PROVIDER_URL and ANCHOR_WALLET to point at the config authority.
`);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  let apply = false;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    printUsage();
  }

  return { apply };
}

function readPubkey(data: Buffer, start: number) {
  return new PublicKey(data.subarray(start, start + 32));
}

function readU64(data: Buffer, start: number) {
  return data.readBigUInt64LE(start);
}

function readI64(data: Buffer, start: number) {
  return data.readBigInt64LE(start);
}

function readU32(data: Buffer, start: number) {
  return data.readUInt32LE(start);
}

function parseLegacyConfig(data: Buffer): ParsedConfig {
  return {
    authority: readPubkey(data, 8),
    minStake: readU64(data, 40),
    disputeBond: readU64(data, 48),
    minAuthorBondForFreeListing: readU64(data, 48),
    slashPercentage: data.readUInt8(56),
    cooldownPeriod: readI64(data, 57),
    stakeWeight: readU32(data, 65),
    vouchWeight: readU32(data, 69),
    longevityBonus: readU32(data, 77),
    legacyDisputePenalty: readU32(data, 73),
    bump: data.readUInt8(81),
  };
}

function parseCurrentConfig(data: Buffer): ParsedConfig {
  return {
    authority: readPubkey(data, 8),
    minStake: readU64(data, 40),
    disputeBond: readU64(data, 48),
    minAuthorBondForFreeListing: readU64(data, 56),
    slashPercentage: data.readUInt8(64),
    cooldownPeriod: readI64(data, 65),
    stakeWeight: readU32(data, 73),
    vouchWeight: readU32(data, 77),
    longevityBonus: readU32(data, 81),
    bump: data.readUInt8(85),
  };
}

function formatLamports(value: bigint) {
  return `${value.toString()} lamports`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .Agentvouch as Program<Agentvouch>;
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const accountInfo = await provider.connection.getAccountInfo(
    configPda,
    "confirmed"
  );
  if (!accountInfo) {
    throw new Error(
      `Config PDA ${configPda.toBase58()} does not exist on this cluster. Run initialize_config instead.`
    );
  }

  if (!accountInfo.owner.equals(program.programId)) {
    throw new Error(
      `Config PDA ${configPda.toBase58()} is owned by ${accountInfo.owner.toBase58()}, expected ${program.programId.toBase58()}`
    );
  }

  console.log("Program ID:", program.programId.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Config size:", accountInfo.data.length, "bytes");

  let parsed: ParsedConfig;
  if (accountInfo.data.length === LEGACY_REPUTATION_CONFIG_LEN) {
    parsed = parseLegacyConfig(accountInfo.data);
    console.log("Layout: legacy 82-byte config");
    console.log(
      "Legacy dispute penalty:",
      parsed.legacyDisputePenalty ?? "(not present)"
    );
    console.log(
      "Mapped min_author_bond_for_free_listing:",
      formatLamports(parsed.minAuthorBondForFreeListing)
    );
  } else if (accountInfo.data.length === CURRENT_REPUTATION_CONFIG_LEN) {
    parsed = parseCurrentConfig(accountInfo.data);
    console.log("Layout: current 86-byte config");
  } else {
    throw new Error(
      `Unsupported config size ${accountInfo.data.length}; expected ${LEGACY_REPUTATION_CONFIG_LEN} or ${CURRENT_REPUTATION_CONFIG_LEN}`
    );
  }

  console.log("Authority:", parsed.authority.toBase58());
  console.log("Min stake:", formatLamports(parsed.minStake));
  console.log("Dispute bond:", formatLamports(parsed.disputeBond));
  console.log("Slash percentage:", parsed.slashPercentage);
  console.log("Cooldown period:", parsed.cooldownPeriod.toString(), "seconds");
  console.log("Stake weight:", parsed.stakeWeight);
  console.log("Vouch weight:", parsed.vouchWeight);
  console.log("Longevity bonus:", parsed.longevityBonus);
  console.log("Stored bump:", parsed.bump);

  if (!parsed.authority.equals(provider.wallet.publicKey)) {
    throw new Error(
      `Connected wallet ${provider.wallet.publicKey.toBase58()} is not the config authority ${parsed.authority.toBase58()}`
    );
  }

  if (accountInfo.data.length === CURRENT_REPUTATION_CONFIG_LEN) {
    console.log("Config already uses the current layout. No migration needed.");
    return;
  }

  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to migrate the config.");
    return;
  }

  const tx = await program.methods
    .migrateConfig()
    .accountsPartial({
      authority: provider.wallet.publicKey,
    })
    .rpc();

  console.log("Migration transaction:", tx);

  const migratedAccount = await program.account.reputationConfig.fetch(
    configPda
  );
  console.log("Migrated config size:", CURRENT_REPUTATION_CONFIG_LEN, "bytes");
  console.log(
    "Migrated min_author_bond_for_free_listing:",
    migratedAccount.minAuthorBondForFreeListing.toString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
