use anchor_lang::prelude::*;

declare_id!("8oaQoLPjeT8cKxE1R8NZLtyopbWLgHq19uHVF4UHQZTF");

#[program]
pub mod stake_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let user_state = &mut ctx.accounts.user_state;
        let staking_pool = &mut ctx.accounts.staking_pool;

        // Transfer SOL from user to staking pool
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &staking_pool.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                staking_pool.to_account_info(),
            ],
        )?;

        // Update user state
        user_state.amount_staked += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 8, // 8 bytes for discriminator + 8 bytes for amount_staked
        seeds = [b"user_state", user.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserState>,
    /// CHECK: This is the staking pool account, which is safe to use as AccountInfo
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump
    )]
    pub staking_pool: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserState {
    pub amount_staked: u64,
}
