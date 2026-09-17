/**
 * 全件を取り切る。
 *
 * Supabase（PostgREST）は 1 リクエストあたり 1000 行で打ち切る。`.limit(5000)` の
 * ような指定は黙って 1000 行に丸められ、エラーにもならない。`order("date", desc)`
 * と組むと古い行から落ちるので、「全期間」のはずの集計が、気づかないうちに直近
 * 数ヶ月分だけになる。実際に page_views で 1306 行のうち 1000 行しか見ていなかった。
 *
 * 呼び出し側は range だけを受けてクエリを組む。
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
