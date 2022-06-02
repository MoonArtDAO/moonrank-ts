// @ts-ignore
import { fs } from 'mz';

interface NFTProp {
  [key: string]: any;
}

interface NFTProps {
  [key: number]: NFTProp;
}

interface AggregateProps {
  [key: string]: { [key: string]: number };
}

interface NFTRarity {
  id: string;
  props: { [key: string]: any };
  rarity: number;
  rank?: number;
  relative?: number;
}

interface Shape {
  [key: string]: number;
}

export async function runRanks() {
  const properties: NFTProps = {},
    files: { [key: string]: any } = {},
    json_files = await fs.promises.readdir('./files');

  for (const file of json_files) {
    const json = JSON.parse(fs.readFileSync(`./files/${file}`, 'utf8'));

    files[file] = json;

    properties[json.edition] = normalizeProps(json);
  }

  const shape = calculateShape(properties),
    aggregate = injectNullsAndAggregate(properties, shape),
    rankings = [];

  let total = 1;

  for (const index in properties) {
    const props = properties[index],
      ranking: NFTRarity = { id: index, props: {}, rarity: 1 };

    for (const prop in props) {
      let value = props[prop];

      if (value === '') {
        value = '✓';
      }

      const sub_total = Object.values(aggregate[prop]).reduce(
          (a: any, b: any) => a + b,
        ),
        occurence = aggregate[prop][value];

      ranking.rarity *= occurence / sub_total;

      ranking['props'][prop] = {
        n: `${value === false ? '∅' : value}`,
        v: `1/${occurence}`,
        p: ((occurence / sub_total) * 100).toFixed(2) + '%',
      };
    }
    rankings.push(ranking);

    total++;
  }

  rankings.sort((a, b) => (a.rarity > b.rarity ? 1 : -1));

  let nfts: any = [aggregate];

  let i = 1;
  for (const ranking of rankings) {
    let nft: { [key: string]: any } = {};

    nft.rarity = ranking.rarity;
    nft.Rank = i;
    nft.relativeRarity = '' + (i / total) * 100;
    nft.rarityProps = ranking.props;

    nfts.push(nft);

    i++;
  }

  fs.writeFileSync('./rarity.json', JSON.stringify(nfts, null, 2));
}

function normalizeProps(input: any): { [key: string]: string } {
  const ret: { [key: string]: string } = {};

  if (input.properties !== undefined) {
    for (const k in input.properties) {
      const v = input.properties[k];
      if (typeof v === 'string') {
        ret[k] = v;
      } else {
        ret[k] = v.value;
      }
    }

    ret = input.properties;
  } else if (input.attributes !== undefined && input.attributes.length > 0) {
    for (const i of input.attributes) {
      ret[i.trait_type] = i.value;
    }
  }

  return ret;
}

function injectNullsAndAggregate(nfts: NFTProps, shape: Shape): AggregateProps {
  const prop_map: { [key: string]: boolean } = {},
    prop_counts: AggregateProps = {};

  for (const asset_id in nfts) {
    const props = nfts[asset_id];

    for (const k in shape) {
      if (props[k] === undefined) {
        props[k] = false;

        if (prop_map[k] === undefined) {
          shape[k] += 1;
          prop_map[k] = true;
        }
      }
    }

    for (const k in props) {
      let value = props[k];

      if (value === '') {
        value = '✓';
      }

      if (prop_counts[k] === undefined) {
        prop_counts[k] = {};
      }

      if (prop_counts[k][value] === undefined) {
        prop_counts[k][value] = 1;
      } else {
        prop_counts[k][value] += 1;
      }
    }
  }

  return prop_counts;
}

function calculateShape(nfts: NFTProps, filter?: NFTProp) {
  const shape: Shape = {};

  for (const asset_id in nfts) {
    const props = nfts[asset_id];
    for (const property in props) {
      if (filter && filter[property] === true) {
        //delete nfts[asset_id][property];
      } else {
        shape[property] = (shape[property] || 0) + 1;
      }
    }
  }

  return shape;
}

(() => {
  runRanks();
})();
