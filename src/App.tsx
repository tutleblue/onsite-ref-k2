import { useEffect, useMemo, useState } from 'react'
import {
  CHANNEL_NAME,
  DAY_SEED,
  DEMO_START_MIN,
  PREP_TIMES,
  type Channel,
  type Order,
  fmtTime,
  generateDay,
  loadClock,
  saveClock,
  simNow,
  todayKey,
  won,
} from './sim'

type Status = 'new' | 'accepted' | 'cooking' | 'done'

interface OrderState {
  status: Status
  prep?: number
  acceptedAt?: number
}

const STATUS_LABEL: Record<Status, string> = {
  new: '신규',
  accepted: '접수',
  cooking: '조리중',
  done: '완료',
}

const KEY = 'kimbap.orders.v1'

function load(): Record<string, OrderState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const f = () => setHash(location.hash || '#/')
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const [clock, setClock] = useState(loadClock)
  const [now, setNow] = useState(() => simNow(clock))
  const [states, setStates] = useState<Record<string, OrderState>>(load)
  const all = useMemo(() => generateDay(DAY_SEED, todayKey()), [])

  useEffect(() => {
    const t = setInterval(() => setNow(simNow(clock)), 1000)
    return () => clearInterval(t)
  }, [clock])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(states))
  }, [states])

  const arrived = all.filter((o) => o.at <= now)

  function stateOf(o: Order): OrderState {
    return states[o.id] ?? { status: o.at < DEMO_START_MIN ? 'done' : 'new' }
  }

  function update(id: string, s: OrderState) {
    setStates((prev) => ({ ...prev, [id]: s }))
  }

  function testOrder() {
    const next = all.find((o) => o.at > now)
    if (!next) return
    const c = { ...clock, offsetSec: clock.offsetSec + (next.at - now) * 60 + 1 }
    saveClock(c)
    setClock(c)
    setNow(simNow(c))
  }

  function reset() {
    if (!confirm('주문 상태를 모두 지우고 처음부터 시작할까요?')) return
    localStorage.removeItem(KEY)
    localStorage.removeItem('kimbap.clock.v1')
    location.reload()
  }

  const kitchen = hash.startsWith('#/kitchen')

  return (
    <div className={kitchen ? 'app kitchen-mode' : 'app'}>
      <header>
        <b className="logo">두줄김밥 주문함</b>
        <nav>
          <a href="#/" className={!kitchen ? 'on' : ''}>
            주문함
          </a>
          <a href="#/kitchen" className={kitchen ? 'on' : ''}>
            주방 화면
          </a>
        </nav>
        <span className="clock">{fmtTime(now)}</span>
        <button className="ghost" onClick={testOrder}>
          테스트 주문
        </button>
        <button className="ghost" onClick={reset}>
          초기화
        </button>
      </header>
      {kitchen ? (
        <Kitchen orders={arrived} stateOf={stateOf} update={update} now={now} />
      ) : (
        <Inbox orders={arrived} stateOf={stateOf} update={update} now={now} />
      )}
    </div>
  )
}

interface ViewProps {
  orders: Order[]
  stateOf: (o: Order) => OrderState
  update: (id: string, s: OrderState) => void
}

function Inbox({ orders, stateOf, update, now }: ViewProps & { now: number }) {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const [prepPick, setPrepPick] = useState<Record<string, number>>({})
  const list = orders
    .filter((o) => (tab === 'open' ? stateOf(o).status !== 'done' : stateOf(o).status === 'done'))
    .slice()
    .reverse()
  const counts = (ch: Channel) => orders.filter((o) => o.channel === ch && stateOf(o).status === 'new').length

  return (
    <main>
      <div className="summary">
        {(['jugeok', 'ppalliwa', 'dongnae'] as Channel[]).map((ch) => (
          <div key={ch} className={`sum ch-${ch}`}>
            {CHANNEL_NAME[ch]} 신규 <b>{counts(ch)}</b>
          </div>
        ))}
      </div>
      <div className="tabs">
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
          진행 중
        </button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>
          완료
        </button>
      </div>
      <table className="orders">
        <thead>
          <tr>
            <th>앱</th>
            <th>시간</th>
            <th>주문번호</th>
            <th>메뉴</th>
            <th>요청사항</th>
            <th>주소</th>
            <th>금액</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => {
            const s = stateOf(o)
            const pick = prepPick[o.id] ?? 15
            return (
              <tr key={o.id} className={s.status === 'new' ? 'is-new' : ''}>
                <td>
                  <span className={`badge ch-${o.channel}`}>{CHANNEL_NAME[o.channel]}</span>
                </td>
                <td>{fmtTime(o.at)}</td>
                <td className="mono">{o.id}</td>
                <td>
                  {o.items.map((i) => (
                    <div key={i.id}>
                      {i.name} x{i.qty}
                      {i.options.length > 0 && <span className="opt"> ({i.options.join(', ')})</span>}
                    </div>
                  ))}
                </td>
                <td>{o.request ? <span className="req">{o.request}</span> : '-'}</td>
                <td>{o.address}</td>
                <td>{won(o.total)}</td>
                <td>
                  {STATUS_LABEL[s.status]}
                  {s.prep ? ` (${s.prep}분)` : ''}
                </td>
                <td className="actions">
                  {s.status === 'new' && (
                    <>
                      <select
                        aria-label="조리시간"
                        value={pick}
                        onChange={(e) => setPrepPick({ ...prepPick, [o.id]: Number(e.target.value) })}
                      >
                        {PREP_TIMES[o.channel].map((m) => (
                          <option key={m} value={m}>
                            {m}분
                          </option>
                        ))}
                      </select>
                      <button onClick={() => update(o.id, { status: 'accepted', prep: pick, acceptedAt: now })}>
                        접수
                      </button>
                    </>
                  )}
                  {s.status === 'accepted' && <button onClick={() => update(o.id, { ...s, status: 'cooking' })}>조리 시작</button>}
                  {s.status === 'cooking' && <button onClick={() => update(o.id, { ...s, status: 'done' })}>완료</button>}
                  {s.status === 'done' && (
                    <button className="ghost" onClick={() => update(o.id, { ...s, status: 'cooking' })}>
                      되돌리기
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {list.length === 0 && <p className="empty">{tab === 'open' ? '진행 중인 주문이 없어요' : '완료된 주문이 없어요'}</p>}
    </main>
  )
}

function Kitchen({ orders, stateOf, update, now }: ViewProps & { now: number }) {
  const list = orders.filter((o) => ['accepted', 'cooking'].includes(stateOf(o).status))
  return (
    <main className="kitchen">
      {list.length === 0 && <p className="empty big">만들 주문이 없어요</p>}
      <div className="cards">
        {list.map((o) => {
          const s = stateOf(o)
          const left = s.prep && s.acceptedAt !== undefined ? Math.round(s.acceptedAt + s.prep - now) : null
          return (
            <section key={o.id} className={`kcard ${s.status}`}>
              <div className="khead">
                <span className={`badge ch-${o.channel}`}>{CHANNEL_NAME[o.channel]}</span>
                <span>{o.id.slice(-4)}</span>
                <span className={left !== null && left < 0 ? 'late' : ''}>
                  {left === null ? '' : left >= 0 ? `${left}분 남음` : `${-left}분 지남`}
                </span>
              </div>
              <ul>
                {o.items.map((i) => (
                  <li key={i.id}>
                    {i.name} <b>{i.qty}</b>
                    {i.options.length > 0 && <div className="kopt">{i.options.join(', ')}</div>}
                  </li>
                ))}
              </ul>
              {o.request && <div className="kreq">{o.request}</div>}
              <div className="kact">
                {s.status === 'accepted' ? (
                  <button onClick={() => update(o.id, { ...s, status: 'cooking' })}>조리 시작</button>
                ) : (
                  <button onClick={() => update(o.id, { ...s, status: 'done' })}>완료</button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
