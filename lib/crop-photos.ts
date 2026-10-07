// Real photographs for lots without their own photos. All from Wikimedia Commons under free
// licenses (public domain, CC0, CC BY, CC BY-SA); credits are shown in the UI and on /credits.

export interface CropPhoto {
  src: string
  title: string
  artist: string
  license: string
  licenseUrl: string | null
  source: string
}

export const CROP_PHOTOS: Record<string, CropPhoto> = {
  "wheat": {
    "src": "/crops/wheat.jpg",
    "title": "Ripe wheat ears",
    "artist": "Jazzmaster1997",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ripe_wheat_ears.jpg"
  },
  "rice": {
    "src": "/crops/rice.jpg",
    "title": "Paddy Harvest 02",
    "artist": "Zaheed Sarwer Khan",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Paddy_Harvest_02.jpg"
  },
  "corn": {
    "src": "/crops/corn.jpg",
    "title": "White Corn on the Cob with husk (27000745034)",
    "artist": "Willis Lam",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:White_Corn_on_the_Cob_with_husk_(27000745034).jpg"
  },
  "barley": {
    "src": "/crops/barley.jpg",
    "title": "Ripening ears of barley - geograph.org.uk - 8084694",
    "artist": "Philip Halling",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ripening_ears_of_barley_-_geograph.org.uk_-_8084694.jpg"
  },
  "soybean": {
    "src": "/crops/soybean.jpg",
    "title": "Soybean field, Abbeville County, South Carolina, USA",
    "artist": "Mlabar",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Soybean_field,_Abbeville_County,_South_Carolina,_USA.jpg"
  },
  "coffee": {
    "src": "/crops/coffee.jpg",
    "title": "Coffee cherries of varying ripeness, on a tree in Colombia (by Brian Smith)",
    "artist": "U. S. Fish and Wildlife Service - Northeast Region",
    "license": "Public domain",
    "licenseUrl": null,
    "source": "https://commons.wikimedia.org/wiki/File:Coffee_cherries_of_varying_ripeness,_on_a_tree_in_Colombia_(by_Brian_Smith).jpg"
  },
  "cotton": {
    "src": "/crops/cotton.jpg",
    "title": "Mature cotton boll in Raichur, Karnataka",
    "artist": "Nanditha Gogate, WELL Labs",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Mature_cotton_boll_in_Raichur,_Karnataka.jpg"
  },
  "tomato": {
    "src": "/crops/tomato.jpg",
    "title": "Tomatoes in basket 2026 G4",
    "artist": "George Chernilevsky",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tomatoes_in_basket_2026_G4.jpg"
  },
  "potato": {
    "src": "/crops/potato.jpg",
    "title": "Potato Harvest in Armenia 2456764",
    "artist": "Narek75",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Potato_Harvest_in_Armenia_2456764.jpg"
  },
  "onion": {
    "src": "/crops/onion.jpg",
    "title": "Onion crop",
    "artist": "Kasyap",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Onion_crop.jpg"
  },
  "spices": {
    "src": "/crops/spices.jpg",
    "title": "Safrron stigmas of Crocus speciosus",
    "artist": "User:Velela",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Safrron_stigmas_of_Crocus_speciosus.jpg"
  },
  "fruit": {
    "src": "/crops/fruit.jpg",
    "title": "Bountiful harvest - Flickr - Muffet",
    "artist": "liz west from Boxborough, MA, USA",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Bountiful_harvest_-_Flickr_-_Muffet.jpg"
  },
  "other": {
    "src": "/crops/other.jpg",
    "title": "Cacao Tree (Theobroma cacao) green pods (17348751253)",
    "artist": "Bernard DUPONT from FRANCE",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Cacao_Tree_(Theobroma_cacao)_green_pods_(17348751253).jpg"
  }
}

export function cropPhoto(cropType?: string | null): CropPhoto {
  return CROP_PHOTOS[cropType ?? ""] ?? CROP_PHOTOS.other
}
