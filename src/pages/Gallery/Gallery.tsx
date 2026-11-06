import { useState } from "react";
import { Button } from "../../components/Button/Button";
import { WritCard } from "../../components/WritCard/WritCard";
import { NftFace } from "../../components/NftFace/NftFace";
import { CheckTable } from "../../components/CheckTable/CheckTable";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
import { Stamp } from "../../components/Stamp/Stamp";
import { Dialog } from "../../components/Dialog/Dialog";
import { LedgerPaper } from "../../components/LedgerPaper/LedgerPaper";
import { Loading, Skeleton } from "../../components/Loading/Loading";
import { FieldList } from "../../components/FieldList/FieldList";
import { Stepper } from "../../components/Stepper/Stepper";
import { Step } from "../../components/Step/Step";
import { SaleReplay } from "../../features/replay/SaleReplay";
import {
  exampleWrit,
  exampleHistory,
  initialWrits,
} from "../../chain/fixtures/writs";
import { replayOutcome } from "../../features/replay/outcomes";
import { useTitle } from "../../hooks/useChain";
import s from "./Gallery.module.css";
export default function Gallery() {
  useTitle("Component gallery");
  const [dialog, setDialog] = useState(false);
  return (
    <div className={`${s.gallery} appContainer`}>
      <p className="sectionLabel">Development only</p>
      <h1>Writ component gallery.</h1>
      <p>All values on this page are examples.</p>
      <section>
        <h2>Actions</h2>
        <div className="actions">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="dark">Dark</Button>
          <Button disabled>Paused while listed</Button>
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
        </div>
      </section>
      <section>
        <h2>Verdicts</h2>
        <div className={s.stamps}>
          <Stamp word="CLEAN" />
          <Stamp word="REFUSED" tone="refused" />
          <Stamp word="LISTED" tone="listed" sub="40 NEAR" />
          <Stamp word="DISCLOSED" tone="listed" />
          <Stamp word="IN SALE" tone="refused" />
        </div>
      </section>
      <section>
        <h2>Writ card states</h2>
        <div className={s.grid}>
          {initialWrits().map((writ) => (
            <WritCard key={writ.id} writ={writ} />
          ))}
        </div>
      </section>
      <section>
        <h2>Standalone NFT faces</h2>
        <div className={s.grid}>
          {initialWrits().map((writ) => (
            <NftFace key={writ.id} writ={writ} />
          ))}
        </div>
      </section>
      <section>
        <h2>Checks</h2>
        <CheckTable rows={replayOutcome("proposed").rows} />
        <DisclosedBox>
          This is the template’s disclosed limit. Page observations do not
          replace settlement checks.
        </DisclosedBox>
      </section>
      <section>
        <h2>Purchase illustration</h2>
        <SaleReplay />
      </section>
      <section>
        <h2>Paper trail</h2>
        <LedgerPaper
          entries={exampleHistory}
          label="Example ledger for Writ 0007."
        />
      </section>
      <section>
        <h2>Loading and fields</h2>
        <Loading />
        <Loading bar />
        <FieldList
          fields={[
            { label: "Account", value: exampleWrit.executor, typed: true },
          ]}
        />
        <div style={{ maxWidth: 300, marginTop: 25 }}>
          <Skeleton />
        </div>
      </section>
      <section>
        <h2>Progress</h2>
        <Stepper
          steps={[
            "Choose the role",
            "Read its owner",
            "Mint the Writ",
            "Hand it over",
            "Confirm",
          ]}
          current={2}
        />
        <div style={{ marginTop: 30 }}>
          <Step
            number={1}
            title="A declared action"
            body="An explanation of one step in the sale."
            signer="Writ contract"
            contract
          />
        </div>
      </section>
      {dialog && (
        <Dialog title="Example modal dialog" onClose={() => setDialog(false)}>
          <h3>Everything stays in focus.</h3>
          <p>
            Tab through these controls. Escape closes the dialog and restores
            focus.
          </p>
          <label>
            Example field
            <input />
          </label>
          <footer>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setDialog(false)}>
              Done
            </Button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
