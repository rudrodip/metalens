export enum MetaTagType {
  Description = "description",
  Keywords = "keywords",
  Author = "author",
  Canonical = "canonical",
  Robots = "robots",
}

export enum OpenGraphType {
  Title = "og:title",
  Description = "og:description",
  Type = "og:type",
  Url = "og:url",
  SiteName = "og:site_name",
  Locale = "og:locale",
  LocaleAlternate = "og:locale:alternate",
  
  Image = "og:image",
  ImageSecureUrl = "og:image:secure_url",
  ImageType = "og:image:type",
  ImageWidth = "og:image:width",
  ImageHeight = "og:image:height",
  ImageAlt = "og:image:alt",
  
  Audio = "og:audio",
  AudioSecureUrl = "og:audio:secure_url",
  AudioType = "og:audio:type",
  
  Video = "og:video",
  VideoSecureUrl = "og:video:secure_url",
  VideoType = "og:video:type",
  VideoWidth = "og:video:width",
  VideoHeight = "og:video:height",
  
  ArticlePublishedTime = "article:published_time",
  ArticleModifiedTime = "article:modified_time",
  ArticleExpirationTime = "article:expiration_time",
  ArticleAuthor = "article:author",
  ArticleSection = "article:section",
  ArticleTag = "article:tag",
  
  ProfileFirstName = "profile:first_name",
  ProfileLastName = "profile:last_name",
  ProfileUsername = "profile:username",
  ProfileGender = "profile:gender",
  
  BookAuthor = "book:author",
  BookIsbn = "book:isbn",
  BookReleaseDate = "book:release_date",
  BookTag = "book:tag",
}

export enum TwitterType {
  Card = "twitter:card",
  Site = "twitter:site",
  SiteId = "twitter:site:id",
  Creator = "twitter:creator",
  CreatorId = "twitter:creator:id",
  Title = "twitter:title",
  Description = "twitter:description",
  
  Image = "twitter:image",
  ImageAlt = "twitter:image:alt",
  
  Player = "twitter:player",
  PlayerWidth = "twitter:player:width",
  PlayerHeight = "twitter:player:height",
  PlayerStream = "twitter:player:stream",
  
  AppNameIphone = "twitter:app:name:iphone",
  AppIdIphone = "twitter:app:id:iphone",
  AppUrlIphone = "twitter:app:url:iphone",
  AppNameIpad = "twitter:app:name:ipad",
  AppIdIpad = "twitter:app:id:ipad",
  AppUrlIpad = "twitter:app:url:ipad",
  AppNameGoogleplay = "twitter:app:name:googleplay",
  AppIdGoogleplay = "twitter:app:id:googleplay",
  AppUrlGoogleplay = "twitter:app:url:googleplay",
}

export interface PageMetadata {
  title: string;
  meta: {
    [key in MetaTagType]?: string;
  };
  openGraph: {
    [key in OpenGraphType]?: string;
  };
  twitter: {
    [key in TwitterType]?: string;
  };
}
