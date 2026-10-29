# 市区町村境界データ

出典：国土交通省「国土数値情報（行政区域データ）」令和3年（2021年）
https://nlftp.mlit.go.jp/ksj/

スマートニュース メディア研究所が公開する簡素化1%の GeoJSON を加工して作成しました。
https://github.com/smartnews-smri/japan-topography
取得元コミット：b403e71eb97f1fdf32f63d16bd485129f703855e
元ファイル：data/municipality/geojson/s0010/N03-21_210101.json

公開元のREADMEでは商用・非商用とも無償利用可能とされ、国土交通省の出典表記が必要です。
国土数値情報の利用条件：https://nlftp.mlit.go.jp/ksj/other/agreement.html

加工：属性を都道府県・市区町村の表示名に集約し、座標を小数点以下5桁に丸め、検索用bboxを追加。
位置情報を外部の地名APIへ送らず、ブラウザ内で点とポリゴンを照合します。
境界の簡素化・位置情報の精度・2021年以後の行政区域変更により誤判定や判定不能があり得ます。
国外・海上などは近隣の自治体を推測せず、判定不能として表示します。
