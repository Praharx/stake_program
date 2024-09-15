import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakeProgram } from "../target/types/stake_program";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("stake_program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.StakeProgram as Program<StakeProgram>;
  const provider = anchor.getProvider();

  it("staking happens correctly", async () => {
    const user = anchor.web3.Keypair.generate();
    const stakeAmount = new anchor.BN(1_000_000_000); // 1 SOL

    // Airdrop 2 SOL to the user
    const signature = await provider.connection.requestAirdrop(user.publicKey, 2_000_000_000);
    await provider.connection.confirmTransaction(signature);

    // Derive PDA for user state
    const [userStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_state"), user.publicKey.toBuffer()],
      program.programId
    );

    // Derive PDA for staking pool
    const [stakingPoolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool")],
      program.programId
    );

    // Get initial balances
    const userInitialBalance = await provider.connection.getBalance(user.publicKey);
    const poolInitialBalance = await provider.connection.getBalance(stakingPoolPDA);

    // Stake
    await program.methods.stake(stakeAmount)
      .accountsStrict({
        user: user.publicKey,
        userState: userStatePDA,
        stakingPool: stakingPoolPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Fetch user state account
    const userState = await program.account.userState.fetch(userStatePDA);

    // Get final balances
    const userFinalBalance = await provider.connection.getBalance(user.publicKey);
    const poolFinalBalance = await provider.connection.getBalance(stakingPoolPDA);

    // Check if user's amount_staked is updated correctly
    expect(userState.amountStaked.toString()).to.equal(stakeAmount.toString());

    // Check if the transfer occurred correctly
    expect(userInitialBalance - userFinalBalance).to.be.above(stakeAmount.toNumber()); // Account for transaction fee
    expect(poolFinalBalance - poolInitialBalance).to.equal(stakeAmount.toNumber());
  });
});

