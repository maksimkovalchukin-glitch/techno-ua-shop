#!/usr/bin/env python3
"""Parse dropshipping.ua XML feed 3537 -> static JSON files for electronics shop."""

import html, json, os, re, sys, urllib.request
from xml.etree.ElementTree import parse, fromstring

OUT_DIR = os.path.join(os.path.dirname(__file__), 'data')
FEED_URL = os.environ.get('FEED_URL', '')
XML_PATH = 'C:/tmp/feed3537.xml'

GROUPS = [
    {'id': 'godynnyky', 'name': 'Годинники', 'icon': 'watch',
     'cats': [11094, 11092, 32821]},
    {'id': 'sumky', 'name': 'Сумки та рюкзаки', 'icon': 'shopping-bag',
     'cats': [2320, 2319, 2587, 2328, 2585, 2326, 2584, 2325, 2318, 4385, 4387, 2330, 2327, 4045, 2332]},
    {'id': 'valisy', 'name': 'Валізи та аксесуари', 'icon': 'briefcase',
     'cats': [2322, 2323, 2324, 2588, 4055, 32839]},
    {'id': 'elektronika', 'name': 'Електроніка', 'icon': 'cpu',
     'cats': [16142, 16780, 25731, 13794, 13795, 25733, 16773, 46722, 16770, 13801, 16779, 25734, 13807]},
    {'id': 'bezpeka', 'name': 'Безпека та відеонагляд', 'icon': 'shield',
     'cats': [15544, 15545, 16756, 15536, 16757, 16758, 18063, 16755, 15540]},
    {'id': 'dim', 'name': 'Дім та побут', 'icon': 'home',
     'cats': [16768, 16772, 26466, 26467, 26470, 26471, 16767, 16761, 26468, 16769, 26493, 13800, 18715]},
    {'id': 'foto', 'name': 'Фото, аудіо та відео', 'icon': 'camera',
     'cats': [25732, 18051, 15539, 18060, 18058, 18059, 37963, 15545]},
]

CAT_NAMES_UK = {
    2318: 'Тактичні сумки',
    2319: 'Дорожні сумки',
    2320: 'Чоловічі сумки',
    2322: 'Маленькі валізи',
    2323: 'Середні валізи',
    2324: 'Великі валізи',
    2325: 'Тактичні рюкзаки',
    2326: 'Рюкзаки для ноутбука',
    2327: 'Рюкзаки Ролтоп',
    2328: 'Міські та спортивні рюкзаки',
    2329: 'Дитячі рюкзаки',
    2330: 'Косметички та кейси',
    2331: 'Набори косметичок',
    2332: 'Жіночі сумки',
    2584: 'Шкільні рюкзаки та портфелі',
    2585: 'Молодіжні рюкзаки',
    2587: 'Сумки для ноутбука',
    2588: 'Валізи на колесах',
    4045: 'Тревел-кейси',
    4055: 'Аксесуари для багажу',
    4385: 'Барсетки',
    4387: 'Несесери',
    11092: 'Наручні та кишенькові годинники',
    11094: 'Смарт-годинники та фітнес-браслети',
    13794: 'Батарейки та акумулятори',
    13795: 'Кабелі та перехідники',
    13800: 'Зарядні станції',
    13801: 'Павербанки',
    13807: 'Зарядні пристрої',
    15536: 'GPS-трекери',
    15539: 'Мікрофони',
    15540: 'Диктофони та аксесуари',
    15544: 'Камери відеоспостереження',
    15545: 'Міні-камери портативні',
    16142: 'Навушники та гарнітури',
    16755: 'Аксесуари для відеоспостереження',
    16756: 'Охоронні системи та сигналізації',
    16757: 'Домофони',
    16758: 'Дверні відеоочка',
    16760: 'Лічильники електроенергії',
    16761: 'Датчики для дому',
    16762: 'Пульти та дублікатори',
    16767: 'Побутові терморегулятори',
    16768: 'Метеостанції та аксесуари',
    16769: 'Дверні дзвінки',
    16770: 'Зарядні для портативних пристроїв',
    16771: 'Озонатори',
    16772: 'Зволожувачі та очищувачі повітря',
    16773: 'Карти пам\'яті',
    16779: 'Док-станції',
    16780: 'Портативні колонки',
    17401: 'Системи захисту від протікань',
    18051: 'Тримачі та кріплення',
    18058: 'Обладнання для предметної зйомки',
    18059: 'Кільцеві лампи',
    18060: 'FPV-окуляри для квадрокоптерів',
    18063: 'Детектори дронів',
    18715: 'Сейфи',
    25731: 'Комп\'ютерні миші',
    25732: 'Штативи та кріплення для фото/відео',
    25733: 'USB-хаби',
    25734: 'Підставки для пристроїв',
    26466: 'Електрочайники',
    26467: 'Кавоварки та кавомашини',
    26468: 'Кавомолки',
    26469: 'Тостери',
    26470: 'Блендери',
    26471: 'Міксери',
    26472: 'Мультиварки',
    26486: 'Тепловентилятори',
    26493: 'Вентилятори',
    32821: 'Ремінці та браслети для годинників',
    32839: 'Сумки та ремені для фото/відео',
    32843: 'Крокоміри',
    37927: 'Дитячі цифрові фотоапарати',
    37962: 'Планшети',
    37963: 'Проектори',
    46722: 'Килимки для миші',
}


def strip_html(text):
    if not text:
        return ''
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    return re.sub(r'[ \t]+', ' ', text).strip()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print('Parsing XML...')
    if FEED_URL:
        print(f'Downloading from {FEED_URL}')
        with urllib.request.urlopen(FEED_URL, timeout=120) as r:
            root = fromstring(r.read())
        shop = root.find('shop')
    else:
        tree = parse(XML_PATH)
        shop = tree.getroot().find('shop')

    cat_map = {}
    for c in shop.find('categories').findall('category'):
        cid = int(c.get('id'))
        cat_map[cid] = CAT_NAMES_UK.get(cid, c.text or str(cid))

    offers_by_cat = {}
    all_vendors = set()

    for o in shop.find('offers').findall('offer'):
        cat_id = int(o.findtext('categoryId') or 0)
        vendor = o.findtext('vendor') or ''
        if vendor:
            all_vendors.add(vendor)
        product = {
            'id': o.get('id'),
            'available': o.get('available') == 'true',
            'name': o.findtext('name') or '',
            'price': float(o.findtext('price') or 0),
            'vendor': vendor,
            'vendorCode': o.findtext('vendorCode') or '',
            'categoryId': cat_id,
            'pictures': [p.text for p in o.findall('picture') if p.text],
            'description': strip_html(o.findtext('description') or ''),
            'params': [
                {'name': p.get('name'), 'value': p.text}
                for p in o.findall('param')
                if p.text and p.get('name') and len(p.get('name').strip()) > 2
                and not p.get('name').strip().isdigit()
            ],
        }
        offers_by_cat.setdefault(cat_id, []).append(product)

    # Write per-category JSON files
    for cat_id, products in offers_by_cat.items():
        path = os.path.join(OUT_DIR, f'cat_{cat_id}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Written {len(offers_by_cat)} category files')

    # Build groups with metadata (only include categories with available products)
    groups_out = []
    for g in GROUPS:
        cats_out = []
        total = 0
        cover = None
        seen_cats = set()
        for cid in g['cats']:
            if cid in seen_cats:
                continue
            seen_cats.add(cid)
            prods = offers_by_cat.get(cid, [])
            count = sum(1 for p in prods if p['available'])
            if count > 0:
                cats_out.append({'id': cid, 'name': cat_map.get(cid, str(cid)), 'count': count})
                total += count
            if not cover:
                for p in prods:
                    if p['available'] and p['pictures']:
                        cover = p['pictures'][0]
                        break
        if cats_out:
            groups_out.append({
                'id': g['id'],
                'name': g['name'],
                'icon': g['icon'],
                'cats': cats_out,
                'total': total,
                'cover': cover,
            })

    # Featured: first available product with photo per group (prioritize big groups)
    featured = []
    seen_cats = set()
    for cat_id, products in offers_by_cat.items():
        for p in products:
            if p['available'] and p['pictures'] and cat_id not in seen_cats:
                featured.append(p)
                seen_cats.add(cat_id)
                break
    featured = sorted(featured, key=lambda x: x['price'], reverse=True)[:24]

    total_prods = sum(len(v) for v in offers_by_cat.values())
    avail_prods = sum(sum(1 for p in v if p['available']) for v in offers_by_cat.values())

    catalog = {
        'groups': groups_out,
        'allCats': [{'id': k, 'name': v} for k, v in sorted(cat_map.items())],
        'vendors': sorted(list(all_vendors)),
        'stats': {
            'total': total_prods,
            'available': avail_prods,
            'categories': len(cat_map),
            'groups': len(groups_out),
        },
    }

    with open(os.path.join(OUT_DIR, 'catalog.json'), 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))

    with open(os.path.join(OUT_DIR, 'featured.json'), 'w', encoding='utf-8') as f:
        json.dump(featured, f, ensure_ascii=False, separators=(',', ':'))

    print(f'catalog.json: {len(groups_out)} groups, {total_prods} products ({avail_prods} available)')
    print(f'featured.json: {len(featured)} products')
    print('Done!')


if __name__ == '__main__':
    main()
