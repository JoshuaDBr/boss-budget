import { OUT_OF_SCOPE, placeholder } from './placeholder'

export default function BossButton() {
  return (
    <div id="bossC" className="comp">
      <button id="bossBtn" {...placeholder(OUT_OF_SCOPE)}>BOSS</button>
    </div>
  )
}
