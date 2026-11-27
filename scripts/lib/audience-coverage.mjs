// Offline aggregate-only audit. No provider imports or network calls.
export function audienceCoverage(data) {
  if (data?.status !== 'completed' || !Array.isArray(data.audience?.people) || data.audience.people.length > 20 || !Array.isArray(data.profileInputs) || data.profileInputs.length > 20) {
    throw Error('完成済みの分析記録と保存プロフィールが必要です');
  }
  const people = data.audience.people;
  const result = {
    processed: people.length, public: 0, private: 0, missing: 0,
    publicEmptyBio: 0, publicNoPostText: 0, publicNoText: 0,
    publicWithText: 0, profilesWithPostsUsed: 0, postsAvailable: 0,
    postsUsed: 0, truncatedProfiles: 0, savedCharsOmitted: 0,
    genderKnown: 0, ageKnown: 0, interestKnown: 0, selfRated100Findings: 0,
    needsPublicPosts: 0,
  };
  for (const person of people) {
    const profile = data.profileInputs.find(p => typeof p.username === 'string' && p.username.toLowerCase() === String(person.username).toLowerCase());
    if (!profile) result.missing++;
    else if (profile.private || profile.isPrivate) result.private++;
    else {
      result.public++;
      const bio = String(profile.biography ?? '').slice(0, 2000);
      const posts = (Array.isArray(profile.latestPosts) ? profile.latestPosts : []).slice(0, 20).map(p => String(p.caption ?? '').slice(0, 400)).filter(t => t.trim());
      if (!bio.trim()) result.publicEmptyBio++;
      if (!posts.length) { result.publicNoPostText++; result.needsPublicPosts++; }
      if (!bio.trim() && !posts.length) result.publicNoText++; else result.publicWithText++;
      result.postsAvailable += posts.length;
      let remaining = 1500, usedPosts = 0, availableChars = 0, usedChars = 0;
      for (const [i, text] of [bio, ...posts].entries()) {
        availableChars += text.length;
        const used = text.slice(0, remaining);
        remaining -= used.length; usedChars += used.length;
        if (i > 0 && used.trim()) usedPosts++;
      }
      result.postsUsed += usedPosts;
      if (usedPosts) result.profilesWithPostsUsed++;
      if (availableChars > usedChars) result.truncatedProfiles++;
      result.savedCharsOmitted += availableChars - usedChars;
    }
    const known = f => !!f && f.value !== '不明' && f.confidence >= 0.6 && Array.isArray(f.evidence) && f.evidence.length > 0;
    if (known(person.gender)) result.genderKnown++;
    if (known(person.age)) result.ageKnown++;
    const interests = (Array.isArray(person.interests) ? person.interests : []).filter(known);
    if (interests.length) result.interestKnown++;
    result.selfRated100Findings += [person.gender, person.age, ...interests].filter(f => known(f) && f.confidence === 1).length;
  }
  return result;
}
