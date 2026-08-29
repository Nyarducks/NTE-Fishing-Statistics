import { useEffect, useState, useMemo } from 'react'

export interface RankData {
  count: number
  min: number | null
  avg: number | null
  median: number | null
  max: number | null
}

export interface FishSizeRecord {
  name: string
  stamina: number
  category: string
  bucket: string
  ranks: Record<string, RankData>
}

export interface FishSizeAnalysisPayload {
  generated_at: string
  summary: {
    all_records: number
    records: Record<string, Record<string, RankData>>
  }
  diagnostics: {
    source_records: number
    duplicate_weights_removed: number
  }
  fish_records: FishSizeRecord[]
}



const BUCKETS = ["5", "6", "6+", "9", "12", "15"]
const RANKS = ["s", "a", "b"]
const COLORS: Record<string, string> = { s: "#f6c65b", a: "#57a8ff", b: "#71d5a1" }

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${Math.floor(Number(value)).toLocaleString("ja-JP")}g`
}

function plain(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0"
  return Math.floor(Number(value)).toLocaleString("ja-JP")
}

export default function App() {
  const [data, setData] = useState<FishSizeAnalysisPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFishName, setSelectedFishName] = useState('')
  const [fishSearch, setFishSearch] = useState('')

  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('./data.json')
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json() as FishSizeAnalysisPayload
        setData(json)
      } catch (err: any) {
        setError('データの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    
    if (!data && !loading) {
      loadData()
    }
  }, [data, loading])



  
  

  

  

  useEffect(() => {
    if (!data?.fish_records.length) return
    setSelectedFishName(current => data.fish_records.some(fish => fish.name === current) ? current : data.fish_records[0].name)
  }, [data])

  const matchingFish = useMemo(
    () => (data?.fish_records ?? []).filter(fish => fish.name.includes(fishSearch.trim())),
    [data, fishSearch],
  )

  const selectedFish = useMemo<FishSizeRecord | null>(
    () => matchingFish.find(fish => fish.name === selectedFishName) ?? null,
    [matchingFish, selectedFishName],
  )

  const selectedFishChart = useMemo(() => {
    if (!selectedFish) return null
    const rows = RANKS.map(rank => ({ rank, ...selectedFish.ranks[rank] })).filter(row => row.count && row.min !== null && row.max !== null)
    if (!rows.length) return null
    const low = Math.min(...rows.map(row => row.min as number))
    const high = Math.max(...rows.map(row => row.max as number))
    const position = (value: number) => high === low ? 50 : ((value - low) / (high - low)) * 100
    const boundary = (lowerRank: string, higherRank: string) => {
      const lower = selectedFish.ranks[lowerRank]
      const higher = selectedFish.ranks[higherRank]
      if (!lower?.count || !higher?.count || lower.max === null || higher.min === null) return null
      const difference = higher.min - lower.max
      return { lowerRank, higherRank, difference }
    }
    return {
      rows,
      low,
      high,
      position,
      boundaries: [boundary('b', 'a'), boundary('a', 's')].filter((item): item is NonNullable<typeof item> => item !== null),
    }
  }, [selectedFish])

  useEffect(() => {
    if (matchingFish.length && !matchingFish.some(fish => fish.name === selectedFishName)) {
      setSelectedFishName(matchingFish[0].name)
    }
  }, [matchingFish, selectedFishName])

  const chartData = useMemo(() => {
    if (!data) return null
    
    const records = data.summary.records
    const rows = BUCKETS.flatMap(stamina => RANKS.map(rank => ({ stamina, rank, ...records[stamina]?.[rank] })))
    const available = rows.filter(row => row.count && row.min !== null)
    if (available.length === 0) return null

    const logLow = Math.log10(Math.min(...available.map(row => row.min as number)))
    const logHigh = Math.log10(Math.max(...available.map(row => row.max as number)))
    const position = (value: number) => ((Math.log10(value) - logLow) / (logHigh - logLow)) * 100

    const completeRankGroups = BUCKETS.filter(stamina => RANKS.every(rank => records[stamina]?.[rank]?.median !== null))
    const incompleteRankGroups = BUCKETS.filter(stamina => !completeRankGroups.includes(stamina))

    return { rows, logLow, logHigh, position, completeRankGroups, incompleteRankGroups }
  }, [data])

  

  return (
    <div className="page active flex-col h-full overflow-y-auto p-4 md:p-8 bg-[#0b1020] text-[#edf3ff]">
      <div className="max-w-6xl mx-auto w-full">
        <header className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">魚サイズ分析</h1>
            <p className="text-[#a8b5cf]">スタミナ区分・ランクごとのユニーク重量を集計。範囲は下限〜上限、白線は中央値です。</p>
            {data && <p className="text-[#a8b5cf] text-sm mt-2">生成日時: {new Date(data.generated_at).toLocaleString("ja-JP")}</p>}
          </div>
          
        </header>

        {error && <div className="text-red-400 p-4 bg-red-900/20 border border-red-900/50 rounded mb-6">{error}</div>}

        {!data && loading && <div className="text-center p-12 text-[#a8b5cf]">読み込み中...</div>}
        
        {data && chartData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-4">
                <div className="text-[#a8b5cf] text-sm mb-1">総数</div>
                <div className="text-2xl font-bold">{plain(data.summary.all_records)}</div>
              </div>
              <div className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-4">
                <div className="text-[#a8b5cf] text-sm mb-1">元レコード数</div>
                <div className="text-2xl font-bold">{plain(data.diagnostics?.source_records)}</div>
              </div>
              <div className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-4">
                <div className="text-[#a8b5cf] text-sm mb-1">重複として統合</div>
                <div className="text-2xl font-bold">{plain(data.diagnostics?.duplicate_weights_removed)}</div>
              </div>
              <div className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-4">
                <div className="text-[#a8b5cf] text-sm mb-1">ランク別中央値の順序</div>
                <div className="text-base font-semibold">
                  S/A/Bが揃う{chartData.completeRankGroups.length}区分は、すべて S &gt; A &gt; B
                  {chartData.incompleteRankGroups.length > 0 && <span className="text-sm font-normal text-[#a8b5cf]">（{chartData.incompleteRankGroups.join(", ")}は一部データなし）</span>}
                </div>
              </div>
            </div>

            <section className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-6 mb-6">
              <div className="flex flex-wrap gap-3 justify-between items-baseline mb-2">
                <h2 className="text-xl font-bold">重量レンジ</h2>
                <div className="flex gap-4 text-[#a8b5cf] text-sm">
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#f6c65b] mr-2"></span>S</span>
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#57a8ff] mr-2"></span>A</span>
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#71d5a1] mr-2"></span>B</span>
                </div>
              </div>
              <p className="text-[#a8b5cf] text-sm mb-4">幅が大きく異なるため、横軸は対数スケールです。各バーの左右端は最小・最大、白線は中央値です。</p>
              
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[660px]">
                  <div className="grid grid-cols-[84px_1fr_96px] text-[#a8b5cf] text-xs mb-2">
                    <span>区分 / ランク</span>
                    <div className="flex justify-between">
                      <span>{fmt(Math.pow(10, chartData.logLow))}</span>
                      <span>{fmt(Math.pow(10, (chartData.logLow + chartData.logHigh) / 2))}</span>
                      <span>{fmt(Math.pow(10, chartData.logHigh))}</span>
                    </div>
                    <span className="text-right">下限〜上限</span>
                  </div>
                  
                  {BUCKETS.flatMap((stamina, bucketIndex) => {
                    const elements = []
                    for (let rankIndex = 0; rankIndex < RANKS.length; rankIndex++) {
                      const rank = RANKS[rankIndex]
                      const row = chartData.rows.find(r => r.stamina === stamina && r.rank === rank)!
                      
                      const isFirstInBucket = rankIndex === 0
                      const borderClass = isFirstInBucket && bucketIndex > 0 ? 'border-t-2 border-[#51617e] mt-1 pt-1' : 'border-t border-[#31415f]/50'
                      
                      if (!row.count) {
                        elements.push(
                          <div key={`${stamina}-${rank}`} className={`grid grid-cols-[84px_1fr_96px] min-h-[31px] items-center ${borderClass}`}>
                            <span className="font-bold">{row.stamina} / {row.rank.toUpperCase()}</span>
                            <div className="relative h-5" style={{ background: 'repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), rgba(49, 65, 95, 0.65) calc(25% - 1px), rgba(49, 65, 95, 0.65) 25%)' }}></div>
                            <span className="text-right text-[#a8b5cf] text-xs tabular-nums">データなし</span>
                          </div>
                        )
                      } else {
                        const left = chartData.position(row.min as number)
                        const right = chartData.position(row.max as number)
                        const median = chartData.position(row.median as number)
                        
                        elements.push(
                          <div key={`${stamina}-${rank}`} className={`grid grid-cols-[84px_1fr_96px] min-h-[31px] items-center ${borderClass}`}>
                            <span className="font-bold">{row.stamina} / {row.rank.toUpperCase()}</span>
                            <div className="relative h-[22px]" style={{ background: 'repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), rgba(49, 65, 95, 0.65) calc(25% - 1px), rgba(49, 65, 95, 0.65) 25%)' }}>
                              <span className="absolute h-2 top-[7px] rounded-full opacity-90" style={{ backgroundColor: COLORS[row.rank], left: `${left}%`, width: `${Math.max(right - left, 0.7)}%` }}></span>
                              <span title={`中央値: ${fmt(row.median)}`} className="absolute w-[3px] h-[19px] top-[1px] rounded-sm bg-white shadow-[0_0_0_1px_#06101f] cursor-help" style={{ left: `${median}%` }}></span>
                            </div>
                            <span className="text-right text-[#a8b5cf] text-xs tabular-nums">{fmt(row.min)}〜{fmt(row.max)}</span>
                          </div>
                        )
                      }
                      
                      if (rankIndex < RANKS.length - 1) {
                        const nextRank = RANKS[rankIndex + 1]
                        const lower = chartData.rows.find(r => r.stamina === stamina && r.rank === nextRank)!
                        const higher = row
                        
                        if (lower.count && higher.count && lower.max !== null && higher.min !== null) {
                          const diff = (higher.min as number) - (lower.max as number)
                          const isGap = diff > 0
                          const isOverlap = diff < 0
                          const lowerEnd = chartData.position(lower.max as number)
                          const higherStart = chartData.position(higher.min as number)
                          const left = Math.min(lowerEnd, higherStart)
                          const width = Math.max(Math.abs(higherStart - lowerEnd), 0)
                          
                          elements.push(
                            <div key={`${stamina}-${nextRank}-${rank}-bound`} className="grid grid-cols-[84px_1fr_96px] min-h-[16px] items-center -my-[4px] z-10 relative pointer-events-none">
                              <div></div>
                              <div className="relative h-[16px]">
                                {isGap ? (
                                  <div className="absolute top-[8px] border-emerald-400/80 border-t border-x h-[5px]" style={{ left: `${left}%`, width: `${width}%` }}>
                                    <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-emerald-300 font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                      {plain(diff)}g gap
                                    </span>
                                  </div>
                                ) : isOverlap ? (
                                  <div className="absolute top-[8px] bg-amber-500/20 border-amber-400/90 border-t border-x h-[5px]" style={{ left: `${left}%`, width: `${width}%` }}>
                                    <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-amber-300 font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                      {plain(Math.abs(diff))}g overlap
                                    </span>
                                  </div>
                                ) : (
                                  <div className="absolute top-[8px] border-[#a8b5cf] border-l h-[5px]" style={{ left: `${left}%` }}>
                                    <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-[#a8b5cf] font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                      0g gap
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div></div>
                            </div>
                          )
                        }
                      }
                    }
                    return elements
                  })}
                </div>
              </div>
            </section>

            <section className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-6 mb-6">
              <div className="flex flex-wrap gap-3 justify-between items-baseline mb-4">
                <div>
                  <h2 className="text-xl font-bold">魚種ごとのランク帯</h2>
                  <p className="text-[#a8b5cf] text-sm mt-1">同じ魚種内での S / A / B の重量を確認できます。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#a8b5cf]">
                  <label className="flex items-center gap-2">
                    検索
                    <input
                      value={fishSearch}
                      onChange={event => setFishSearch(event.target.value)}
                      placeholder="魚名を入力"
                      className="bg-[#0b1020] border border-[#51617e] rounded px-3 py-2 text-[#edf3ff] w-40"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    魚種
                    <select
                      value={selectedFishName}
                      onChange={event => setSelectedFishName(event.target.value)}
                      className="bg-[#0b1020] border border-[#51617e] rounded px-3 py-2 text-[#edf3ff] max-w-[260px]"
                    >
                      {matchingFish.map(fish => (
                        <option key={fish.name} value={fish.name}>{fish.name.replace(/ \(\d+\)$/, '')}（{fish.bucket}）</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs">{matchingFish.length} 件</span>
                </div>
              </div>

              {selectedFish && (
                <>
                  <p className="text-[#a8b5cf] text-sm mb-3">
                    スタミナ: {selectedFish.stamina} / 分類: {selectedFish.category || '—'} / 集計区分: {selectedFish.bucket}
                  </p>
                  {selectedFishChart && (
                    <div className="mb-5 rounded-lg bg-[#0b1020]/65 p-4">
                      <h3 className="font-semibold mb-1">ランク帯の重なり</h3>
                      <p className="text-[#a8b5cf] text-xs mb-3">バーは下限〜上限、白線は中央値です。下の細い帯は、下位ランクの上限と上位ランクの下限の間を示します。</p>
                      <div className="relative">
                        <div className="relative z-10">
                          <div className="grid grid-cols-[32px_1fr_96px] text-[#a8b5cf] text-xs mb-1">
                            <span>ランク</span>
                            <div className="flex justify-between"><span>{fmt(selectedFishChart.low)}</span><span>{fmt(selectedFishChart.high)}</span></div>
                            <span className="text-right">下限〜上限</span>
                          </div>
                          {selectedFishChart.rows.flatMap((row, i, arr) => {
                            const left = selectedFishChart.position(row.min as number)
                            const right = selectedFishChart.position(row.max as number)
                            const median = selectedFishChart.position(row.median as number)
                            
                            const elements = []
                            elements.push(
                              <div key={row.rank} className="grid grid-cols-[32px_1fr_96px] min-h-[31px] items-center border-t border-[#31415f]/50">
                                <span className="font-bold">{row.rank.toUpperCase()}</span>
                                <div className="relative h-[22px]" style={{ background: 'repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), rgba(49, 65, 95, 0.65) calc(25% - 1px), rgba(49, 65, 95, 0.65) 25%)' }}>
                                  <span className="absolute h-2 top-[7px] rounded-full opacity-90" style={{ backgroundColor: COLORS[row.rank], left: `${left}%`, width: `${Math.max(right - left, 0.7)}%` }}></span>
                                  <span title={`中央値: ${fmt(row.median)}`} className="absolute w-[3px] h-[19px] top-[1px] rounded-sm bg-white shadow-[0_0_0_1px_#06101f] cursor-help" style={{ left: `${median}%` }}></span>
                                </div>
                                <span className="text-right text-[#a8b5cf] text-xs tabular-nums">{fmt(row.min)}〜{fmt(row.max)}</span>
                              </div>
                            )
                            
                            if (i < arr.length - 1) {
                              const nextRow = arr[i + 1]
                              const diff = (row.min as number) - (nextRow.max as number)
                              const isGap = diff > 0
                              const isOverlap = diff < 0
                              const lowerEnd = selectedFishChart.position(nextRow.max as number)
                              const higherStart = selectedFishChart.position(row.min as number)
                              const boundLeft = Math.min(lowerEnd, higherStart)
                              const boundWidth = Math.max(Math.abs(higherStart - lowerEnd), 0)
                              
                              elements.push(
                                <div key={`${nextRow.rank}-${row.rank}-bound`} className="grid grid-cols-[32px_1fr_96px] min-h-[16px] items-center -my-[4px] z-10 relative pointer-events-none">
                                  <div></div>
                                  <div className="relative h-[16px]">
                                    {isGap ? (
                                      <div className="absolute top-[8px] border-emerald-400/80 border-t border-x h-[5px]" style={{ left: `${boundLeft}%`, width: `${boundWidth}%` }}>
                                        <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-emerald-300 font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                          {plain(diff)}g gap
                                        </span>
                                      </div>
                                    ) : isOverlap ? (
                                      <div className="absolute top-[8px] bg-amber-500/20 border-amber-400/90 border-t border-x h-[5px]" style={{ left: `${boundLeft}%`, width: `${boundWidth}%` }}>
                                        <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-amber-300 font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                          {plain(Math.abs(diff))}g overlap
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="absolute top-[8px] border-[#a8b5cf] border-l h-[5px]" style={{ left: `${boundLeft}%` }}>
                                        <span className="absolute left-full ml-1.5 whitespace-nowrap text-[10px] text-[#a8b5cf] font-mono leading-none -translate-y-[4.5px] drop-shadow-md">
                                          0g gap
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div></div>
                                </div>
                              )
                            }
                            
                            return elements
                          })}
                        </div></div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse whitespace-nowrap tabular-nums text-right text-sm">
                      <thead>
                        <tr className="border-b border-[#31415f]/65 text-[#a8b5cf] font-semibold text-xs text-left">
                          <th className="p-3">ランク</th>
                          <th className="p-3 text-right">総数</th>
                          <th className="p-3 text-right">下限</th>
                          <th className="p-3 text-right">中央値</th>
                          <th className="p-3 text-right">上限</th>
                          <th className="p-3 text-right">振れ幅</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#31415f]/65">
                        {RANKS.map(rank => {
                          const row = selectedFish.ranks[rank]
                          return (
                            <tr key={rank} className="hover:bg-white/5">
                              <td className="p-3 text-left"><span className="inline-grid place-items-center w-6 h-6 rounded-full text-[#08111f] font-extrabold text-xs" style={{ backgroundColor: COLORS[rank] }}>{rank.toUpperCase()}</span></td>
                              <td className="p-3">{plain(row?.count)}</td>
                              <td className="p-3">{fmt(row?.min)}</td>
                              <td className="p-3">{fmt(row?.median)}</td>
                              <td className="p-3">{fmt(row?.max)}</td>
                              <td className="p-3">{row?.count ? fmt((row.max as number) - (row.min as number)) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!selectedFish && <p className="text-[#a8b5cf] text-sm">該当する魚種がありません。</p>}
            </section>

            <section className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-6 mb-6">
              <div className="flex flex-wrap gap-3 justify-between items-baseline mb-2">
                <h2 className="text-xl font-bold">中央値の推移</h2>
                <div className="flex gap-4 text-[#a8b5cf] text-sm">
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#f6c65b] mr-2"></span>S</span>
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#57a8ff] mr-2"></span>A</span>
                  <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#71d5a1] mr-2"></span>B</span>
                </div>
              </div>
              <p className="text-[#a8b5cf] text-sm mb-4">同じランクでのスタミナ区分ごとの中央値です。6+は特殊ドロップ区分です。</p>
              
              <div className="overflow-x-auto">
                <svg viewBox="0 0 1000 390" className="w-full min-w-[660px] h-auto block">
                  {(() => {
                    const width = 1000, height = 390, left = 72, right = 35, chartTop = 26, bottom = 66
                    const graphW = width - left - right, graphH = height - chartTop - bottom
                    const x = (index: number) => left + (graphW * index / (BUCKETS.length - 1))
                    const y = (val: number) => chartTop + graphH * (1 - ((Math.log10(val) - chartData.logLow) / (chartData.logHigh - chartData.logLow)))
                    const ticks = [chartData.logLow, (chartData.logLow + chartData.logHigh) / 2, chartData.logHigh]
                    
                    return (
                      <>
                        {ticks.map((tick, i) => {
                          const yy = chartTop + graphH * (1 - ((tick - chartData.logLow) / (chartData.logHigh - chartData.logLow)))
                          return (
                            <g key={`grid-${i}`}>
                              <line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#31415f" strokeWidth="1" />
                              <text x={left - 10} y={yy + 4} fill="#a8b5cf" fontSize="13" textAnchor="end">{fmt(Math.pow(10, tick))}</text>
                            </g>
                          )
                        })}
                        
                        {BUCKETS.map((bucket, i) => (
                          <text key={`label-${i}`} x={x(i)} y={height - 28} fill="#a8b5cf" fontSize="13" textAnchor="middle">{bucket}</text>
                        ))}
                        
                        {RANKS.map(rank => {
                          const points = BUCKETS.map((bucket, index) => ({ value: data.summary.records[bucket]?.[rank]?.median, index })).filter(p => p.value !== null && p.value !== undefined)
                          if (points.length === 0) return null
                          
                          const pathStr = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)},${y(p.value as number)}`).join(" ")
                          
                          return (
                            <g key={`line-${rank}`}>
                              <path d={pathStr} fill="none" stroke={COLORS[rank]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              {points.map((p, i) => (
                                <circle key={`dot-${i}`} cx={x(p.index)} cy={y(p.value as number)} r="5" fill={COLORS[rank]} stroke="#0b1020" strokeWidth="2" />
                              ))}
                            </g>
                          )
                        })}
                        
                        <text x={left} y={height - 7} fill="#a8b5cf" fontSize="13">スタミナ区分（対数スケール）</text>
                      </>
                    )
                  })()}
                </svg>
              </div>
            </section>

            <section className="bg-[#151d32]/90 border border-[#31415f] rounded-xl p-6 mb-6">
              <div className="flex justify-between items-baseline mb-4">
                <h2 className="text-xl font-bold">集計表</h2>
                <span className="text-[#a8b5cf] text-sm">振れ幅 = 上限 − 下限</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse whitespace-nowrap tabular-nums text-right text-sm">
                  <thead>
                    <tr className="border-b border-[#31415f]/65 text-[#a8b5cf] font-semibold text-xs text-left">
                      <th className="p-3">スタミナ</th>
                      <th className="p-3">ランク</th>
                      <th className="p-3 text-right">総数</th>
                      <th className="p-3 text-right">下限</th>
                      <th className="p-3 text-right">中央値</th>
                      <th className="p-3 text-right">上限</th>
                      <th className="p-3 text-right">振れ幅</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#31415f]/65">
                    {chartData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-3 text-left">{row.stamina}</td>
                        <td className="p-3 text-left">
                          <span className="inline-grid place-items-center w-6 h-6 rounded-full text-[#08111f] font-extrabold text-xs" style={{ backgroundColor: COLORS[row.rank] }}>
                            {row.rank.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">{plain(row.count)}</td>
                        <td className="p-3">{fmt(row.min)}</td>
                        <td className="p-3">{fmt(row.median)}</td>
                        <td className="p-3">{fmt(row.max)}</td>
                        <td className="p-3">{row.count ? fmt((row.max as number) - (row.min as number)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
