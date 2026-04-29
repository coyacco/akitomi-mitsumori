import "./PrintPreview.css";
import { useEffect } from "react";
import type { DetailHeader, DetailRow, MitsumoriCompany } from "./types";

export default function PrintPreview({
    header,
    items,
    company,
    onClose,
}: {
    header: DetailHeader;
    items: DetailRow[];
    company: MitsumoriCompany | null;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(() => {
            window.print();
        }, 300);

        window.addEventListener("afterprint", onClose);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("afterprint", onClose);
        };
    }, [onClose]);

    const isShowSubtotal: boolean = (header.goukei ?? 0) > 0 && (header.sotozeigaku ?? 0) > 0;

    return (
        <div className="pp-root">
            <div className="pp-page">
                {/* 上部 */}
                <div className="pp-top-row">
                    <div>No.{header.mitsumori_no}</div>
                    <div className="pp-title">御見積書</div>
                    <div>{header.sakusei}</div>
                </div>

                {/* 宛先 + 会社情報 */}
                <div className="pp-header-main">
                    <div className="pp-header-left">
                        <div className="pp-customer-name">
                            {header.mitsumorisaki_meisho} {header.keisho}
                        </div>

                        <div className="pp-amount-box">
                            <span className="pp-amount-label">合計金額</span>
                            <span className="pp-amount-value">
                                ￥{header.goukei_kingaku?.toLocaleString()} -
                            </span>
                        </div>

                        <table className="pp-terms-table">
                            <tbody>
                                <tr>
                                    <td className="pp-term-label">取引条件</td>
                                    <td className="pp-term-value">{header.torihiki_jouken ?? ""}</td>
                                </tr>
                                <tr>
                                    <td className="pp-term-label">有効期限</td>
                                    <td className="pp-term-value">{header.yukou_kigen ?? ""}</td>
                                </tr>
                                <tr>
                                    <td className="pp-term-label">受渡期日</td>
                                    <td className="pp-term-value">{header.ukewatashi_kijitu ?? ""}</td>
                                </tr>
                                <tr>
                                    <td className="pp-term-label">受渡場所</td>
                                    <td className="pp-term-value">{header.ukewatashi_basho ?? ""}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="pp-header-right">
                        <div className="pp-company-name">
                            <span className="pp-kabu">株式会社</span>
                            秋富商店
                        </div>
                        <div>{company?.daihyou}</div>
                        <div>〒{company?.yubin} {company?.jusho1}</div>
                        <div className="pp-tel-fax">
                            <span>TEL {company?.tel}</span>
                            <span>FAX {company?.fax}</span>
                        </div>
                        <div className="pp-torihiki-bank">
                            <span>取引銀行</span>
                            <span>{company?.ginkou}</span>
                        </div>
                    </div>
                </div>

                {/* 明細 */}
                <table className="pp-detail-table">
                    <thead>
                        <tr>
                            <th style={{ width: "42%" }}>品名・仕様</th>
                            <th style={{ width: "7%" }}>数量</th>
                            <th style={{ width: "6%" }}>単位</th>
                            <th style={{ width: "12%" }}>単価</th>
                            <th style={{ width: "13%" }}>金額</th>
                            <th style={{ width: "20%" }}>備考</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((i, idx) => (
                            <tr key={idx}>
                                <td className="pp-text-left">{i.hinmoku}</td>
                                <td className="pp-text-right">{i.suryo}</td>
                                <td className="pp-text-center">{i.tanni}</td>
                                <td className="pp-text-right">
                                    {i.tannka?.toLocaleString()}
                                </td>
                                <td className="pp-text-right">
                                    {i.kingaku?.toLocaleString()}
                                </td>
                                <td className="pp-text-left">{i.bikou}</td>
                            </tr>
                        ))}

                        {/* 最低20行になるように空行を追加 */}
                        {Array.from({
                            length: Math.max(0, 20 - items.length),
                        }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <td>&nbsp;</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        ))}

                        {/* --- 小計（goukei > 0 かつ sotozeigaku > 0） --- */}
                        {isShowSubtotal && (
                            <tr>
                                <td colSpan={2} className="no-border"></td>
                                <td colSpan={2} className="pp-text-left">小計</td>
                                <td className="pp-text-right">{header.goukei?.toLocaleString() ?? ""}</td>
                                <td className="no-border"></td>
                            </tr>
                        )}

                        {/* --- 消費税（goukei > 0 かつ sotozeigaku > 0） --- */}
                        {isShowSubtotal && (
                            <tr>
                                <td colSpan={2} className="no-border"></td>
                                <td colSpan={2} className="pp-text-left">
                                    {header.zeiritsu == null
                                        ? "消費税"
                                        : `消費税（${header.zeiritsu.toFixed(0)}％）`}
                                </td>
                                <td className="pp-text-right">{header.sotozeigaku?.toLocaleString() ?? ""}</td>
                                <td className="no-border"></td>
                            </tr>
                        )}

                        <tr>
                            <td colSpan={2} className="pp-note">{!isShowSubtotal && "（この金額には消費税は含まれておりません）"}</td>
                            <td colSpan={2} className="pp-text-left">
                                合計
                            </td>
                            <td className="pp-text-right">
                                {header.goukei_kingaku?.toLocaleString()}
                            </td>
                            <td className="no-border"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}