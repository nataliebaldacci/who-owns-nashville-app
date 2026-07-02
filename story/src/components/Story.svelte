<script>
  import Scrolly from "$components/helpers/Scrolly.svelte";

  let deals = $state([]);
  let value = $state(0);

  $effect(() => {
    if (deals.length === 0) {
      fetch("./data/progress_deals.json")
        .then((r) => r.json())
        .then((d) => (deals = d.deals || []));
    }
  });

  const cur = $derived(deals[value] || {});
  const cum = $derived.by(() => {
    let homes = 0, appr = 0;
    for (let i = 0; i <= value && i < deals.length; i++) {
      homes += deals[i].n || 0;
      appr += deals[i].appraised_total || 0;
    }
    return { homes, appr };
  });
  const cleanLender = (l) => {
    if (!l) return "—";
    const u = l.toUpperCase();
    if (u.includes("GOLDMAN")) return "Goldman Sachs";
    if (u.includes("GERMAN AMERICAN")) return "German American Capital (Deutsche Bank)";
    if (u.includes("BARCLAYS")) return "Barclays";
    if (u.includes("ROYAL BANK")) return "Royal Bank of Canada";
    if (u.includes("MORGAN STANLEY")) return "Morgan Stanley";
    if (u.includes("WELLS FARGO")) return "Wells Fargo";
    if (u.includes("BANK OF AMERICA")) return "Bank of America";
    return l.split(" ").slice(0, 3).join(" ");
  };
  const M = (v) => (v ? "$" + Number(v).toLocaleString() : "—");
  const Mn = (v) => (v ? "$" + (v / 1e6).toFixed(0) + "M" : "—");
</script>

<section id="story">
  <div class="sticky">
    <div class="viz">
      <div class="deal">{cur.deal ? "Progress " + (cur.deal_name && cur.deal_name !== "nan" ? cur.deal_name.replace(/Progress Residential /i, "") : cur.deal) : "—"}</div>
      <div class="date">{cur.date || ""}</div>
      <div class="grid">
        <div><b>{cum.homes.toLocaleString()}</b><span>Homes pledged so far</span></div>
        <div><b>${(cum.appr / 1e6).toFixed(0)}M</b><span>Appraised value pledged</span></div>
        <div><b>{Mn(cur.loan_amount)}</b><span>This deal's bond</span></div>
        <div><b class="lender">{cleanLender(cur.lender)}</b><span>Lender / originator</span></div>
      </div>
    </div>
  </div>

  <div class="steps">
    <Scrolly bind:value>
      {#each deals as d, i}
        {@const active = value === i}
        <div class="step" class:active>
          <p>
            <span class="dt">{d.date}</span> — Progress recorded
            <b>{d.n}</b> more Nashville homes into
            <b>{d.deal_name && d.deal_name !== "nan" ? d.deal_name.replace(/Progress Residential /i, "") : d.deal}</b>,
            a {Mn(d.loan_amount)} securitization financed by
            <b>{cleanLender(d.lender)}</b>.
          </p>
        </div>
      {/each}
    </Scrolly>
  </div>
</section>

<style>
  #story { position: relative; max-width: 1100px; margin: 0 auto; }
  .sticky { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .viz { background: #fff; border: 1px solid #cdd6e3; border-radius: 12px; box-shadow: 0 8px 30px #0001; padding: 28px 34px; width: min(460px, 42vw); text-align: center; }
  .deal { font-family: Georgia, serif; font-weight: 700; font-size: 24px; color: #1f3a5f; }
  .date { color: #2c6e78; font-weight: 600; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
  .grid b { display: block; font-size: 30px; color: #1f3a5f; font-variant-numeric: tabular-nums; line-height: 1.05; }
  .grid b.lender { font-size: 15px; }
  .grid span { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #8a94a0; }
  .steps { position: relative; z-index: 1; width: min(430px, 40vw); margin-left: 4vw; }
  .step { min-height: 78vh; display: flex; align-items: center; }
  .step p { background: #1f3a5f; color: #fff; padding: 20px 22px; border-radius: 10px; font-size: 17px; line-height: 1.55; opacity: .35; transition: opacity .25s; }
  .step.active p { opacity: 1; }
  .step b { color: #e8663a; }
</style>
