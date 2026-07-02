<script>
  import Story from "$components/Story.svelte";
</script>

<svelte:boundary onerror={(e) => console.error(e)}>
  <header class="hero">
    <p class="kicker">Who Owns Nashville?</p>
    <h1>Wall Street bought the neighborhood, one bond deal at a time.</h1>
    <p class="dek">
      Between 2015 and 2026, Progress Residential quietly assembled a book of
      Nashville single-family homes — then pledged them, in bundles, as
      collateral for billion-dollar securitizations sold to bond investors.
      Scroll to watch it happen, deal by deal.
    </p>
    <div class="scroll-cue">↓ scroll</div>
  </header>

  <Story />

  <footer class="end">
    <h2>This is one operator. There are dozens.</h2>
    <p>
      Progress is the largest, but American Homes 4 Rent, Amherst, Invitation,
      Tricon and a long tail of LLCs run the same playbook across Davidson County.
    </p>
    <p class="src">
      Source: Davidson County Register of Deeds, SEC EDGAR ABS-15G filings, and
      securitization deeds of trust. Built from primary records.
    </p>
  </footer>
</svelte:boundary>

<style>
  :global(body) { margin: 0; font-family: "Atlas Grotesk", -apple-system, sans-serif; color: #20303f; }
  .hero { min-height: 92vh; display: flex; flex-direction: column; justify-content: center; max-width: 900px; margin: 0 auto; padding: 0 24px; }
  .kicker { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #e8663a; font-weight: 700; margin: 0 0 12px; }
  h1 { font-family: Georgia, serif; font-size: clamp(34px, 6vw, 62px); line-height: 1.05; color: #1f3a5f; margin: 0 0 20px; }
  .dek { font-size: 19px; line-height: 1.6; color: #3a4652; max-width: 640px; }
  .scroll-cue { margin-top: 40px; color: #8a94a0; font-size: 14px; letter-spacing: 1px; }
  .end { max-width: 720px; margin: 8vh auto 16vh; padding: 0 24px; text-align: center; }
  .end h2 { font-family: Georgia, serif; font-size: clamp(26px, 4vw, 40px); color: #1f3a5f; }
  .end p { font-size: 18px; line-height: 1.6; color: #3a4652; }
  .end .src { font-size: 13px; color: #8a94a0; margin-top: 28px; }
</style>
