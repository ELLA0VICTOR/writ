import { ChainError, messageOf } from "../../chain/errors";
import { Button, ButtonLink } from "../Button/Button";
export function ErrorSheet({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const pending =
    error instanceof ChainError && error.code === "not_configured";
  return (
    <div className="emptySheet" role="alert">
      <p className="sectionLabel">
        {pending ? "Deployment pending" : "The read did not complete"}
      </p>
      <h2 style={{ fontSize: 32 }}>
        {pending
          ? "The contracts are being connected."
          : "Your Writ is unaffected."}
      </h2>
      <p>{messageOf(error)}</p>
      <div className="actions">
        {pending ? (
          <ButtonLink to="/market?mock=1" variant="primary">
            Explore example Writs
          </ButtonLink>
        ) : (
          <Button onClick={retry} variant="primary">
            Retry
          </Button>
        )}
        <ButtonLink to="/">Back to Writ</ButtonLink>
      </div>
    </div>
  );
}
