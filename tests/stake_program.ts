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

    // Derive PDA for staking pool vault
    const [stakingPoolVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool_vault")],
      program.programId
    );

    // Get initial balances
    const userInitialBalance = await provider.connection.getBalance(user.publicKey);
    const poolInitialBalance = await provider.connection.getBalance(stakingPoolVaultPDA);

    // Stake
    await program.methods.stake(stakeAmount)
      .accountsStrict({
        user: user.publicKey,
        userState: userStatePDA,
        stakingPool: stakingPoolPDA,
        stakingPoolVault: stakingPoolVaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Fetch user state account
    const userState = await program.account.userState.fetch(userStatePDA);

    // Get final balances
    const userFinalBalance = await provider.connection.getBalance(user.publicKey);
    const poolFinalBalance = await provider.connection.getBalance(stakingPoolVaultPDA);

    // Check if user's amount_staked is updated correctly
    expect(userState.amountStaked.toString()).to.equal(stakeAmount.toString());

    // Check if the transfer occurred correctly
    expect(userInitialBalance - userFinalBalance).to.be.above(stakeAmount.toNumber()); // Account for transaction fee
    expect(poolFinalBalance - poolInitialBalance).to.equal(stakeAmount.toNumber());
  });

  it("unstaking happens correctly", async () => {
    const user = anchor.web3.Keypair.generate();
    const stakeAmount = new anchor.BN(6_000_000_000); // 6 SOL

    // Airdrop 7 SOL to the user
    const signature = await provider.connection.requestAirdrop(user.publicKey, 7_000_000_000);
    await provider.connection.confirmTransaction(signature);

    // Derive PDAs
    const [userStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_state"), user.publicKey.toBuffer()],
      program.programId
    );
    const [stakingPoolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool")],
      program.programId
    );
    const [stakingPoolVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool_vault")],
      program.programId
    );

    // Stake 6 SOL
    await program.methods.stake(stakeAmount)
      .accountsStrict({
        user: user.publicKey,
        userState: userStatePDA,
        stakingPool: stakingPoolPDA,
        stakingPoolVault: stakingPoolVaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Get balances before unstaking
    const userBalanceBeforeUnstake = await provider.connection.getBalance(user.publicKey);
    const poolBalanceBeforeUnstake = await provider.connection.getBalance(stakingPoolVaultPDA);

    // Unstake
    await program.methods.unstake()
      .accountsStrict({
        user: user.publicKey,
        userState: userStatePDA,
        stakingPool: stakingPoolPDA,
        stakingPoolVault: stakingPoolVaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Fetch user state account after unstaking
    const userStateAfterUnstake = await program.account.userState.fetch(userStatePDA);

    // Get balances after unstaking
    const userBalanceAfterUnstake = await provider.connection.getBalance(user.publicKey);
    const poolBalanceAfterUnstake = await provider.connection.getBalance(stakingPoolVaultPDA);

    // Check if the transfer happened correctly
    expect(userBalanceAfterUnstake - userBalanceBeforeUnstake).to.be.approximately(stakeAmount.toNumber(), 10000); // Allow for small difference due to fees
    expect(poolBalanceBeforeUnstake - poolBalanceAfterUnstake).to.equal(stakeAmount.toNumber());

    // Check if amount_staked becomes zero
    expect(userStateAfterUnstake.amountStaked.toNumber()).to.equal(0);

    // Try to unstake again (should fail because amount is 0)
    try {
      await program.methods.unstake()
        .accountsStrict({
          user: user.publicKey,
          userState: userStatePDA,
          stakingPool: stakingPoolPDA,
          stakingPoolVault: stakingPoolVaultPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      expect.fail("Unstaking with 0 balance should have failed");
    } catch (error) {
      expect(error.error.errorMessage).to.equal("No staked amount found for this user.");
    }

    // Try to stake less than 5 SOL and then unstake (should fail)
    const smallStakeAmount = new anchor.BN(4_000_000_000); // 4 SOL
    await program.methods.stake(smallStakeAmount)
      .accountsStrict({
        user: user.publicKey,
        userState: userStatePDA,
        stakingPool: stakingPoolPDA,
        stakingPoolVault: stakingPoolVaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    try {
      await program.methods.unstake()
        .accountsStrict({
          user: user.publicKey,
          userState: userStatePDA,
          stakingPool: stakingPoolPDA,
          stakingPoolVault: stakingPoolVaultPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      expect.fail("Unstaking less than 5 SOL should have failed");
    } catch (error) {
      console.log(error )
    }
  });
});
