// Content for the generated Obsidian Bases file (`.base`) that provides
// ready-made gallery and table views over the media library.
export const MEDIA_VIEWS_BASE = `filters:
  and:
    - type == "movie" || type == "tv" || type == "videogame" || type == "book"
formulas:
  Type: if(type == "movie", "🎬 Movie", if(type == "tv", "📺 TV", if(type == "videogame", "🎮 Game", "📚 Book")))
properties:
  note.cover:
    displayName: Cover
  note.status:
    displayName: Status
  note.rating:
    displayName: Rating
  formula.Type:
    displayName: Type
views:
  - type: cards
    name: All
    groupBy:
      property: status
      direction: DESC
    order:
      - title
      - formula.Type
      - status
      - rating
    sort:
      - property: date
        direction: DESC
      - property: release_date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
  - type: cards
    name: Movies
    filters:
      and:
        - type == "movie"
    sort:
      - property: date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
  - type: cards
    name: TV Shows
    filters:
      and:
        - type == "tv"
    sort:
      - property: date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
  - type: cards
    name: Games
    filters:
      and:
        - type == "videogame"
    sort:
      - property: date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
  - type: cards
    name: Books
    filters:
      and:
        - type == "book"
    sort:
      - property: date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
  - type: table
    name: Table
    order:
      - formula.Type
      - title
      - status
      - rating
      - date
      - tags
    sort:
      - property: date
        direction: DESC
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
`;
