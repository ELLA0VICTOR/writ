import { describe, it, expect } from "vitest";
import { renderWritSvg, xmlEscape } from "../../src/nft/renderWritSvg";
import { initialWrits, exampleWrit } from "../../src/chain/fixtures/writs";
describe("portable NFT face", () => {
  for (const writ of initialWrits())
    it(`matches the ${writ.status} face`, () => {
      const svg = renderWritSvg(writ);
      expect(svg).toContain("data:font/woff2;base64,");
      expect(svg).toContain('width="1000" height="1000"');
      expect(
        svg.replace(
          /<style>[\s\S]*?<\/style>/,
          "<style>[embedded font subsets]</style>",
        ),
      ).toMatchSnapshot();
    });
  it("escapes untrusted text", () => {
    expect(xmlEscape('<script>&"')).toBe("&lt;script&gt;&amp;&quot;");
    expect(
      renderWritSvg({ ...exampleWrit, target: "<script>alert(1)</script>" }),
    ).not.toContain("<script>");
  });
});
