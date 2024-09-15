use anchor_lang::prelude::*;

declare_id!("2tfr7R1Y3sFpdnc27p9jHFWQmLqzysEURmpJ436RhbkU");

#[program]
pub mod stake_program {
    use super::*;

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let user_state = &mut ctx.accounts.user_state;
        // let staking_pool = &mut ctx.accounts.staking_pool;

        // Transfer SOL from user to staking pool using CpiContext
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.staking_pool_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update user state
        user_state.amount_staked += amount;
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let user_state = &mut ctx.accounts.user_state;

        // Check if the user has enough staked amount
        let amount = user_state.amount_staked;
        msg!(&amount.to_string());
        
        if amount == 0 {
            return Err(ErrorCode::NoStakedAmount.into());
        }
        if amount < 5_000_000_000 {
            return Err(ErrorCode::NotEnoughSolStaked.into());
        }
                
        // Transfer SOL from staking pool to user using CpiContext
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.staking_pool_vault.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                &[&[
                    b"staking_pool_vault",
                    &[ctx.bumps.staking_pool_vault]
                ]],
            ),
            amount,
        )?;

        // Update user state
        user_state.amount_staked = 0;
        Ok(())
    }
}

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
    #[account(
        mut, 
        seeds = [b"staking_pool_vault"],
        bump
    )]
    pub staking_pool_vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
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
    #[account(
        mut, 
        seeds = [b"staking_pool_vault"],
        bump
    )]
    pub staking_pool_vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserState {
    pub amount_staked: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("No staked amount found for this user.")]
    NoStakedAmount,
    #[msg("Not enough SOL staked!")]
    NotEnoughSolStaked,
}
