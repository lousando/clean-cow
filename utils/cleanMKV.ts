export default async function cleanMKV(filePath = "") {
  console.log(`Cleaning ${filePath}`);

  const mediaInfoCommand = await new Deno.Command("mediainfo", {
    args: [
      "--Output=JSON",
      filePath,
    ],
  }).output();

  let mediaInfo;
  let mediaInfoRaw;

  try {
    mediaInfoRaw = new TextDecoder().decode(mediaInfoCommand.stdout);
    mediaInfo = JSON.parse(mediaInfoRaw);
  } catch (_error) {
    console.error(
      `%cFailed to parse video metadata for ${filePath}.`,
      "color: red",
    );
    console.error(mediaInfoRaw);
    return;
  }

  const hasSubs = mediaInfo.media?.track?.find((t) => t["@type"] === "Text");

  if (mediaInfoCommand.code !== 0) {
    console.error("%cFailed to get video metadata.", "color: red");
    return;
  }

  // remove unwanted video meta
  const mkvpropeditCommand = await new Deno.Command("mkvpropedit", {
    args: [
      // no video title
      "-d",
      "title",
      // no audio track title names
      "--edit",
      "track:a1",
      "-d",
      "name",
      // todo: more intelligently remove all audio track names
      // "--edit",
      // "track:a2",
      // "-d",
      // "name",
      filePath,
    ],
  }).output();

  if (mkvpropeditCommand.code !== 0) {
    console.error(
      `%cFailed to Remove video metadata [${mkvpropeditCommand.code}]: ${filePath}`,
      "color: red",
    );
    console.error(new TextDecoder().decode(mediaInfoCommand.stderr));
    return;
  }

  if (!hasSubs) {
    console.log("No subs found");
    console.log(`%cCleaned: ${filePath}`, "color: green");
    return;
  }

  console.log("%cSubs found, removing...", "color: yellow");

  // make backup
  await Deno.rename(filePath, `${filePath}.backup`);

  // remove video subs and title metadata
  const removeSubsTask = await new Deno.Command("ffmpeg", {
    args: [
      "-i",
      `${filePath}.backup`,

      /**
       * Copy all streams
       */
      "-map",
      "0",

      "-c",
      "copy",
      "-sn", // no subs
      /**
       * no title
       */
      "-metadata",
      "title=",
      filePath,
    ],
  }).output();

  if (removeSubsTask.code === 0) {
    await Deno.remove(`${filePath}.backup`);
    console.log(`%cCleaned: ${filePath}`, "color: green");
  } else {
    // task failed, restore backup
    await Deno.rename(`${filePath}.backup`, filePath);
    console.error("Failed to clean: ", filePath);
  }
}