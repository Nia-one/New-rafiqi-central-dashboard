import assert from "node:assert/strict"
import test from "node:test"
import { OPERATING_LENS_COOKIE, operatingLensFromCookie } from "@/components/lens"

test("operating lens preference accepts only the two presentation lenses", () => {
  assert.equal(operatingLensFromCookie(`${OPERATING_LENS_COOKIE}=decide`), "decide")
  assert.equal(operatingLensFromCookie(`theme=dark; ${OPERATING_LENS_COOKIE}=operate; session=protected`), "operate")
  assert.equal(operatingLensFromCookie(`${OPERATING_LENS_COOKIE}=admin`), null)
  assert.equal(operatingLensFromCookie("theme=dark"), null)
})
