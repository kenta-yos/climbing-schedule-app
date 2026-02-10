import streamlit as st
import pandas as pd
import plotly.express as px
# utils.py から必要な機能をインポート
from utils import get_supabase_data, safe_save, get_now_jp

def show_page():
    # --- 初期定義 (元のコードそのまま) ---
    now_jp = get_now_jp()
    today_jp = now_jp.date()
    
    # データの取得 (元のコードそのまま)
    log_df = get_supabase_data("climbing_logs")
    user_df = get_supabase_data("users")
    
    # 未ログイン時のガード（念のため）
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "📊 ダッシュボード"
    
    # --- 1. 期間指定（実績の統計用） ---
    st.subheader("📊 ダッシュボード")
    sc1, sc2 = st.columns(2)
    ms = sc1.date_input("開始", value=today_jp.replace(day=1), key="stat_start")
    me = sc2.date_input("終了", value=today_jp, key="stat_end")
    
    ms_ts = pd.Timestamp(ms)
    me_ts = pd.Timestamp(me)
    
    # --- 2. データの抽出 ---
    if not log_df.empty:
        # 【実績】は期間で絞り込む
        filtered_done = log_df[
            (log_df['user'] == st.session_state.USER) & 
            (log_df['type'] == '実績') & 
            (log_df['date'] >= ms_ts) & 
            (log_df['date'] <= me_ts)
        ].sort_values('date', ascending=False)
        
        # 【予定】は期間に関係なく自分のものを全件出す
        all_my_plans = log_df[
            (log_df['user'] == st.session_state.USER) & 
            (log_df['type'] == '予定')
        ].sort_values('date') # 予定なので日付順
    else:
        filtered_done = pd.DataFrame()
        all_my_plans = pd.DataFrame()
    
    # --- 3. 統計グラフの表示（ここは実績ベース） ---
    if not filtered_done.empty:
        st.markdown(f'''
            <div class="insta-card">
                <div style="display: flex; justify-content: space-around;">
                    <div><div class="insta-val">{len(filtered_done)}</div><div class="insta-label">Sessions</div></div>
                    <div><div class="insta-val">{filtered_done["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div>
                </div>
            </div>
        ''', unsafe_allow_html=True)
        
        counts = filtered_done['gym_name'].value_counts().reset_index()
        counts.columns = ['gym_name', 'count']
        counts = counts.sort_values('count', ascending=True)
        
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', 
                     color='count', color_continuous_scale='Sunsetdark')
        fig.update_traces(texttemplate='  <b>%{text}</b>', textposition='outside', cliponaxis=False)
        fig.update_layout(
            showlegend=False, coloraxis_showscale=False, xaxis_visible=False, 
            yaxis_title=None, margin=dict(t=10, b=10, l=120, r=80), 
            height=max(150, 35 * len(counts)), paper_bgcolor='rgba(0,0,0,0)', 
            plot_bgcolor='rgba(0,0,0,0)', dragmode=False,            
        )
        
        st.markdown('<div style="pointer-events: none;">', unsafe_allow_html=True)
        st.plotly_chart(
            fig, 
            use_container_width=True, 
            config={
                'staticPlot': True,        # これが最強：グラフを完全に静止画にする
                'displayModeBar': False,   # 上のメニューも出さない
                'scrollZoom': False,
                'doubleClick': False,
                'showAxisDragHandles': False
            }
        )
        st.markdown('</div>', unsafe_allow_html=True)
        
    else:
        st.info("この期間の実績はまだありません。")
    
    st.divider()
    
    # --- 4. 予定と実績をタブで表示 ---
    st.subheader("📝 履歴一覧")
    m_tabs = st.tabs(["📅 全ての予定", "✅ 期間内の実績"])
    
    # スタイルは共通
    st.markdown("""
        <style>
        .compact-row {
            display: grid;
            grid-template-columns: 4px 45px 35px 1fr;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .compact-date { font-size: 0.8rem; font-weight: 700; color: #666; }
        .compact-gym { font-size: 0.85rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        </style>
    """, unsafe_allow_html=True)
    
    # アイコンマップの定義
    icon_map = {
        "昼": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/hiru.png?raw=true" width="18"/>',
        "夕方": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/yuu.png?raw=true" width="18"/>',
        "夜": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/yoru.png?raw=true" width="18"/>'
    }
    
    with m_tabs[0]: # 予定タブ：全期間
        if all_my_plans.empty:
            st.caption("予定はありません。")
        else:
            for _, row in all_my_plans.iterrows():
                # アイコンの取得
                ts = row.get('time_slot')
                icon_html = icon_map.get(ts, "") # なければ空文字

                # 💡 columnsを使わずに、一つのコンテナとしてボタンとテキストを配置
                # 全体を覆う「外枠」をMarkdownで作る
                st.markdown(f'''
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; overflow: hidden;">
                            <div style="background:#4CAF50; width:4px; height:18px; border-radius:2px; flex-shrink:0;"></div>
                            <div style="min-width: 42px; font-size: 0.8rem; font-weight: bold; color: #666; flex-shrink:0;">{row["date"].strftime("%m/%d")}</div>
                            <div style="min-width: 20px; flex-shrink:0; display: flex; justify-content: center;">{icon_html}</div>
                            <div style="font-size: 0.85rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                {row["gym_name"]}
                            </div>
                        </div>
                        <div id="btn-container-{row['id']}"></div>
                    </div>
                ''', unsafe_allow_html=True)
                
                # 💡 ゴミ箱ボタンだけはStreamlitの機能が必要なので、
                # columnsを[0.9, 0.1]のように極端な比率で使い、スマホでも縦並びにならないように工夫します
                # (Streamlitの仕様上、0.1のような極端な幅はスマホでも横に並びやすいです)
                empty_col, btn_col = st.columns([0.88, 0.12])
                with btn_col:
                    # ボタンの見た目を整えるために少し上にずらす
                    st.markdown('<div style="margin-top: -45px;">', unsafe_allow_html=True)
                    if st.button("🗑️", key=f"del_p_{row['id']}"):
                        safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")
                    st.markdown('</div>', unsafe_allow_html=True)

                # c1, c2 = st.columns([0.88, 0.12])  
                # with c1:
                #     st.markdown(f'''
                #         <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; gap: 10px;">
                #             <div style="background:#4CAF50; width:4px; height:20px; border-radius:2px; flex-shrink:0;"></div>
                #             <div style="min-width: 45px; font-size: 0.85rem; font-weight: bold; color: #666;">{row["date"].strftime("%m/%d")}</div>
                #             <div style="min-width: 25px; display: flex; justify-content: center;">{icon_html}</div>
                #             <div style="flex-grow: 1; font-size: 0.9rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                #                 {row["gym_name"]}
                #             </div>
                #         </div>
                #     ''', unsafe_allow_html=True)
                
                # with c2:
                #     # ボタンの上の余白を調整して中心に合わせる
                #     st.write("") 
                #     if st.button("🗑️", key=f"del_p_{row['id']}"):
                #         safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")

    with m_tabs[1]: # 実績タブ：期間連動
        if filtered_done.empty:
            st.caption(f"{ms.strftime('%m/%d')}〜{me.strftime('%m/%d')} の実績はありません。")
        else:
            for _, row in filtered_done.iterrows():
                # アイコンの取得
                ts = row.get('time_slot')
                icon_html = icon_map.get(ts, "") # なければ空文字
                
                c1, c2 = st.columns([0.88, 0.12])  
                with c1:
                    st.markdown(f'''
                        <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; gap: 10px;">
                            <div style="background:#DD2476; width:4px; height:20px; border-radius:2px; flex-shrink:0;"></div>
                            <div style="min-width: 45px; font-size: 0.85rem; font-weight: bold; color: #666;">{row["date"].strftime("%m/%d")}</div>
                            <div style="min-width: 25px; display: flex; justify-content: center;">{icon_html}</div>
                            <div style="flex-grow: 1; font-size: 0.9rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                {row["gym_name"]}
                            </div>
                        </div>
                    ''', unsafe_allow_html=True)
                
                with c2:
                    # ボタンの上の余白を調整して中心に合わせる
                    st.write("") 
                    if st.button("🗑️", key=f"del_p_{row['id']}"):
                        safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")
